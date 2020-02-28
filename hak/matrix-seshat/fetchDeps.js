/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const path = require('path');
const childProcess = require('child_process');

const fs = require('fs');
const fsProm = require('fs').promises;
const needle = require('needle');
const tar = require('tar');

module.exports = async function(hakEnv, moduleInfo) {
    if (!hakEnv.isLinux()) {
        await getSqlCipher(hakEnv, moduleInfo);
    }

    if (hakEnv.isWin()) {
        getOpenSsl(hakEnv, moduleInfo);
    }
};

async function getSqlCipher(hakEnv, moduleInfo) {
    const sqlCipherDir = path.join(moduleInfo.moduleDotHakDir, 'sqlcipher-4.3.0');

    let haveSqlcipher;
    try {
        await fsProm.stat(sqlCipherDir);
        haveSqlcipher = true;
    } catch (e) {
        haveSqlcipher = false;
    }

    if (haveSqlcipher) return;

    const sqlCipherTarball = path.join(moduleInfo.moduleDotHakDir, 'sqlcipher-4.3.0.tar.gz');
    let haveSqlcipherTar;
    try {
        await fsProm.stat(sqlCipherTarball);
        haveSqlcipherTar = true;
    } catch (e) {
        haveSqlcipherTar = false;
    }
    if (!haveSqlcipherTar) {
        const bob = needle('get', 'https://github.com/sqlcipher/sqlcipher/archive/v4.3.0.tar.gz', {
            follow: 10,
            output: sqlCipherTarball,
        });
        await bob;
    }

    await tar.x({
        file: sqlCipherTarball,
        cwd: moduleInfo.moduleDotHakDir,
    });

    if (hakEnv.isWin()) {
        // On Windows, we need to patch the makefile because it forces TEMP_STORE to
        // default to files (1) but the README specifically says you '*must*' set it
        // set it to 2 (default to memory).
        const patchFile = path.join(moduleInfo.moduleHakDir, 'sqlcipher-4.3.0-win.patch');

        await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(patchFile);

            const proc = childProcess.spawn(
                'patch',
                ['-p1'],
                {
                    cwd: sqlCipherDir,
                    stdio: ['pipe', 'inherit', 'inherit'],
                },
            );
            proc.on('exit', (code) => {
                code ? reject(code) : resolve();
            });
            readStream.pipe(proc.stdin);
        });
    }
}

async function getOpenSsl(hakEnv, moduleInfo) {
    const openSslDir = path.join(moduleInfo.moduleDotHakDir, 'openssl-1.1.1d');

    let haveOpenSsl;
    try {
        await fsProm.stat(openSslDir);
        haveOpenSsl = true;
    } catch (e) {
        haveOpenSsl = false;
    }

    if (haveOpenSsl) return;

    const openSslTarball = path.join(moduleInfo.moduleDotHakDir, 'openssl-1.1.1d.tar.gz');
    let haveOpenSslTar;
    try {
        await fsProm.stat(openSslTarball);
        haveOpenSslTar = true;
    } catch (e) {
        haveOpenSslTar = false;
    }
    if (!haveOpenSslTar) {
        await needle('get', 'https://www.openssl.org/source/openssl-1.1.1d.tar.gz', {
            follow: 10,
            output: openSslTarball,
        });
    }

    console.log("extracting " + openSslTarball + " in " + moduleInfo.moduleDotHakDir);
    await tar.x({
        file: openSslTarball,
        cwd: moduleInfo.moduleDotHakDir,
    });
}