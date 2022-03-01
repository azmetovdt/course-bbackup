import { Observable, from, map, of } from 'rxjs';

import { DateTime } from 'luxon'
import { promisify } from 'util';
import { spawn } from "child_process";

const exec = promisify(require('child_process').exec)

export class BbFile {
    public modifiedAt: DateTime
    public title: string;

    public constructor(v: Partial<BbFile>) {
        Object.assign(this, v);
    }
}

export class File {
    public modifiedAt: DateTime
    public title: string;

    public constructor(v: Partial<File>) {
        Object.assign(this, v);
    }
}

export class StorageConfig {
    public used: [string, string];
    public currentFiles: [string, string];
    public oldFiles: [string, string];
    public deletedFiles: [string, string];
    public hardLimit: [string, string];

    public constructor(v: Partial<StorageConfig>) {
        Object.assign(this, v);
    }
}

export class ClientConfig {
    public storageHostName: string;
    public updateStoreInterval: string;
    public minimumFileAge: string;

    public constructor(v: Partial<ClientConfig>) {
        Object.assign(this, v);
    }
}

export class QueryRunner {
    public static executeRawQuery(command: string): Observable<string> {
        return from(exec(`bbackupquery '${command}' "exit"`))
            .pipe(
                map((o: any) => o.stdout.trim())
            )
    }

    public static executeRawBash(command: string): Observable<string> {
        return from(exec(command))
            .pipe(
                map((o: any) => o.stdout.trim())
            )
    }

    public static getBackupedFilesList(): Observable<BbFile[]> {
        return this.executeRawQuery('ls home-ohstapit-Documents-backupped- -t')
            .pipe(
                map(s =>
                    s.split('Release')[1]
                        .split('\n')
                        .slice(1)
                        .map(s => new BbFile({ title: s.substring(37), modifiedAt: this.parseDate(s.substring(16, 35)) })))
            )
    }
    
    public static getFilesList(): Observable<File[]> {
        return this.executeRawBash('src/dates.sh')
            .pipe(
                map(s => s
                    .split('\n')
                    .map(s => new BbFile({
                        title: s.split('\\0')[0].split('/').slice(-1)[0],
                        modifiedAt: this.parseDate(s.split('\\0')[1])
                    }))
                )
            )
    }

    public static getStorageConfig(): Observable<StorageConfig> {
        const getRightPartQuery = (lines: string[], index: number): [string, string] =>
            [lines[index].split(',')[1].trim(), lines[index].split(',')[2].split("|")[0].trim()];
        return this.executeRawBash('sudo bbstoreaccounts info 00000001')
            .pipe(
                map(s => s.split('\n')),
                map(lines => new StorageConfig({
                    used: getRightPartQuery(lines, 3),
                    currentFiles: getRightPartQuery(lines, 4),
                    oldFiles: getRightPartQuery(lines, 5),
                    deletedFiles: getRightPartQuery(lines, 6),
                    hardLimit: getRightPartQuery(lines, 9),
                })),
            )
    }

    public static getClientConfig(): Observable<ClientConfig> {
        const getRightPartQuery = (lines: string[], query: string) =>
            lines.find(l => l.includes(query)).split('=')[1].trim();
        return this.executeRawBash('cat /etc/boxbackup/bbackupd.conf')
            .pipe(
                map(s => s.split('\n')),
                map(lines => new ClientConfig({
                    storageHostName: getRightPartQuery(lines, 'StoreHostname'),
                    updateStoreInterval: getRightPartQuery(lines, 'UpdateStoreInterval'),
                    minimumFileAge: getRightPartQuery(lines, 'MinimumFileAge'),
                })),
            )
    }

    public static getRestoredFiles(): Observable<string[]> {
        return this.executeRawBash('ls restored/files')
            .pipe(
                map(s => s.split('\n')),
                map(ss => ss.sort((a, b) => a.split('@')[1].localeCompare(b.split('@')[1]))
                )
            )
    }

    public static getRestoredeFulls(): Observable<string[]> {
        return this.executeRawBash('ls restored/full')
            .pipe(
                map(s => s.split('\n')),
            )
    }

    public static restoreDirectory(): Observable<string> {
        return this.executeRawQuery(`restore home-ohstapit-Documents-backupped- restored/full/${new Date().toISOString()}`)
    }

    public static restoreFile(filename: string): Observable<string> {
        return this.executeRawQuery(`get "home-ohstapit-Documents-backupped-/${filename}" "restored/files/${filename}@${new Date().toISOString()}"`)
    }

    public static runSync(backupRunner: BackupRunner): Observable<string> {
        console.log('Syncing...');
        const s = spawn('sh', ['-c', 'sudo bash -c "bbackupctl sync"'])
        s.stdout.on('data', data => { })
        backupRunner.setLastBackupTime();
        return of('')
    }

    private static parseDate(s: string): DateTime {
        return DateTime.fromISO(s);
    }
}