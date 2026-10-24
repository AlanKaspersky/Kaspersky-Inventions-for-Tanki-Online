const fs = require('fs');
const path = require('path');
const {
    execSync
} = require('child_process');

const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, 'release');

const DIRS = ['dist', 'styles', 'assets', 'database', '_locales', 'templates'];
const FILES = ['manifest.json', 'LICENSE.txt', 'README.md', 'DOCUMENTATION.md', 'MAINTENANCE.md'];

function log(msg) {
    process.stdout.write(`[build] ${msg}\n`);
}

function readVersion() {
    const manifestPath = path.join(ROOT, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        throw new Error('manifest.json не найден в корне проекта');
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!manifest.version) {
        throw new Error('manifest.json: отсутствует поле "version"');
    }
    return manifest.version;
}

function sanitize(name) {
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

function rmIfExists(target) {
    if (fs.existsSync(target)) {
        fs.rmSync(target, {
            recursive: true,
            force: true
        });
    }
}

function copyDir(src, dest) {
    if (!fs.existsSync(src)) {
        log(`пропуск (нет папки): ${path.relative(ROOT, src)}`);
        return false;
    }
    fs.cpSync(src, dest, {
        recursive: true
    });
    log(`скопирована папка: ${path.relative(ROOT, src)}`);
    return true;
}

function copyFile(src, dest) {
    if (!fs.existsSync(src)) {
        log(`пропуск (нет файла): ${path.relative(ROOT, src)}`);
        return false;
    }
    fs.copyFileSync(src, dest);
    log(`скопирован файл: ${path.relative(ROOT, src)}`);
    return true;
}

function zipFolder(sourceDir, zipPath) {
    const parent = path.dirname(sourceDir);
    const base = path.basename(sourceDir);
    const zipAbs = path.resolve(zipPath);

    if (process.platform === 'win32') {
        execSync(
            `tar -a -c -f "${zipAbs}" -C "${parent}" "${base}"`, {
                stdio: 'inherit'
            }
        );
    } else {
        execSync(
            `zip -r "${zipAbs}" "${base}"`, {
                cwd: parent,
                stdio: 'inherit'
            }
        );
    }
}

function zipFolderContents(sourceDir, zipPath) {
    const zipAbs = path.resolve(zipPath);
    const entries = fs.readdirSync(sourceDir);
    if (entries.length === 0) {
        throw new Error(`Папка пуста, нечего упаковывать: ${sourceDir}`);
    }
    // Явно перечисляем верхнеуровневые элементы, чтобы не получить записи "./..."
    const args = entries.map((name) => `"${name}"`).join(' ');

    if (process.platform === 'win32') {
        execSync(`tar -a -c -f "${zipAbs}" -C "${sourceDir}" ${args}`, {
            stdio: 'inherit'
        });
    } else {
        execSync(`zip -r "${zipAbs}" ${args}`, {
            cwd: sourceDir,
            stdio: 'inherit'
        });
    }
}

function main() {
    const version = readVersion();
    const folderName = sanitize(`Kaspersky's Inventions ${version}`);
    const buildDir = path.join(OUT_DIR, folderName);
    const zipPath = path.join(OUT_DIR, `${folderName}.zip`);

    log(`версия: ${version}`);
    log(`сборка: ${path.relative(ROOT, buildDir)}`);

    rmIfExists(buildDir);
    rmIfExists(zipPath);
    fs.mkdirSync(buildDir, {
        recursive: true
    });

    let dirCount = 0;
    let fileCount = 0;

    for (const d of DIRS) {
        if (copyDir(path.join(ROOT, d), path.join(buildDir, d))) dirCount++;
    }
    for (const f of FILES) {
        if (copyFile(path.join(ROOT, f), path.join(buildDir, f))) fileCount++;
    }

    if (dirCount === 0) {
        throw new Error('Не скопировано ни одной папки — проверь DIRS в build-release.js');
    }
    if (fileCount === 0) {
        throw new Error('Не скопировано ни одного файла — проверь FILES в build-release.js');
    }

    log(`упаковка в zip…`);
    zipFolder(buildDir, zipPath);
    const sizeMb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
    log(`готово: ${path.relative(ROOT, zipPath)} (${sizeMb} MB)`);

    const firefoxZipPath = path.join(OUT_DIR, `${folderName}-firefox.zip`);
    rmIfExists(firefoxZipPath);
    log(`упаковка в zip для Firefox (manifest.json в корне)…`);
    zipFolderContents(buildDir, firefoxZipPath);
    const ffSizeMb = (fs.statSync(firefoxZipPath).size / 1024 / 1024).toFixed(2);
    log(`готово: ${path.relative(ROOT, firefoxZipPath)} (${ffSizeMb} MB)`);
}

try {
    main();
} catch (err) {
    console.error(`[build] ОШИБКА: ${err.message}`);
    process.exit(1);
}
