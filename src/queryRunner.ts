import { Observable, from, map, of, tap } from 'rxjs';

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
        return from(exec(`bbackupquery "${command}" "exit"`))
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
                        .map(s => new BbFile({ title: s.split(' ')[4], modifiedAt: this.parseDate(s.split(' ')[2]) })))
            )
    }

    public static getFilesList(): Observable<File[]> {
        return this.executeRawBash('/home/ohstapit/dates.sh')
            .pipe(
                map(s => s
                    .split('\n')
                    .slice(1)
                    .map(s => new BbFile({ title: s.split(' ')[0].split('/').slice(-1)[0], modifiedAt: this.parseDate(s.split(' ')[1]) }))
                ))
    }

    public static getStorageConfig(): Observable<StorageConfig> {
        return this.executeRawBash('sudo bbstoreaccounts info 00000001')
            .pipe(
                map(s => s.split('\n')),
                map(lines => new StorageConfig({
                    used: [lines[3].split(',')[1].trim(), lines[3].split(',')[2].split("|")[0].trim()],
                    currentFiles: [lines[4].split(',')[1].trim(), lines[4].split(',')[2].split("|")[0].trim()],
                    oldFiles: [lines[5].split(',')[1].trim(), lines[5].split(',')[2].split("|")[0].trim()],
                    deletedFiles: [lines[6].split(',')[1].trim(), lines[6].split(',')[2].split("|")[0].trim()],
                    hardLimit: [lines[9].split(',')[1].trim(), lines[9].split(',')[2].split("|")[0].trim()],
                })),
            )

    }

    public static getClientConfig(): Observable<ClientConfig> {
        return this.executeRawBash('cat /etc/boxbackup/bbackupd.conf')
            .pipe(
                map(s => s.split('\n')),
                map(lines => new ClientConfig({
                    storageHostName: lines.find(l => l.includes('StoreHostname')).split('=')[1].trim(),
                    updateStoreInterval: lines.find(l => l.includes('UpdateStoreInterval')).split('=')[1].trim(),
                    minimumFileAge: lines.find(l => l.includes('MinimumFileAge')).split('=')[1].trim(),
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
        return this.executeRawQuery(`get home-ohstapit-Documents-backupped-/${filename} restored/files/${filename}@${new Date().toISOString()}`)
    }


    public static runSync(): Observable<string> {
        console.log('Syncing...');
        const s = spawn('sh', ['-c', 'sudo bash -c "bbackupctl sync"'])
        s.stdout.on('data', data => { })
        return of('')
    }
    
    private static parseDate(s: string): DateTime {
        return DateTime.fromISO(s);
    }

    
}