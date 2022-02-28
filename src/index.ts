import { BbFile, File, QueryRunner } from './queryRunner';

import { BackupRunner } from './backupRunner';
import express from 'express'
import { lastValueFrom } from 'rxjs';

const app = express();
const port = 5000;
const backupRunner = new BackupRunner();

app.set('view engine', 'pug')

app.get('/', async (_request, response) => {
    const backupedFiles = await lastValueFrom(QueryRunner.getBackupedFilesList());
    const backupedFilesMap = Object.fromEntries(backupedFiles.map(f => ([f.title, f])))
    const clientConfig = await lastValueFrom(QueryRunner.getClientConfig())
    const files = await lastValueFrom(QueryRunner.getFilesList());
    const filesMap = Object.fromEntries(files.map(f => ([f.title, f])))
    const restoredFiles = await (lastValueFrom(QueryRunner.getRestoredFiles()))
    const restoredFulls = await (lastValueFrom(QueryRunner.getRestoredeFulls()))
    const risk = BackupRunner.getRisk(files, backupedFilesMap, 0, 0);
    const storageConfig = await (lastValueFrom(QueryRunner.getStorageConfig()))
    
    if (!backupRunner.hasTimerSet || backupRunner.cachedRisk !== risk) {
        updateTimer(files, backupedFilesMap, 0, 0)
    }

    response.render('index', {
        backupedFiles,
        backupedFilesMap,
        clientConfig,
        files,
        filesMap,
        nextBackupTime: backupRunner.nextBackupTime,
        restoredFiles,
        restoredFulls,
        risk,
        storageConfig,
    })
});

app.post('/restore/full', async (_request, response) => {
    await lastValueFrom(QueryRunner.restoreDirectory());
    response.redirect('/')
});

app.post('/restore/file/:title', async (request, response) => {
    await lastValueFrom(QueryRunner.restoreFile(request.params.title));
    response.redirect('/')
});

app.post('/runner/optimize', async (request, response) => {
    const backupedFiles = await lastValueFrom(QueryRunner.getBackupedFilesList());
    const backupedFilesMap = Object.fromEntries(backupedFiles.map(f => ([f.title, f])))
    const clientConfig = await lastValueFrom(QueryRunner.getClientConfig())
    const files = await lastValueFrom(QueryRunner.getFilesList());
    updateTimer(files, backupedFilesMap, 0, 0);
    response.redirect('/')
});

app.post('/runner/sync', async (request, response) => {
    QueryRunner.runSync().subscribe(
        () => response.redirect('/')
    )
});
    
app.use(express.static("public"))

app.listen(port, () => console.log(`Running on port ${port}`));

function updateTimer(files: File[], backupedFilesMap: Record<string, BbFile>, faultCount: number, hoursSinceBackup: number) {
    backupRunner.updateTimer(files, backupedFilesMap, faultCount, hoursSinceBackup, () => {
        backupRunner.removeTimer();
    })
}