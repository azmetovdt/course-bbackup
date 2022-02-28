import { BbFile, File, QueryRunner } from "./queryRunner";

import { DateTime } from "luxon";
import { lastValueFrom } from "rxjs";

export class BackupRunner {
    private timer: NodeJS.Timeout;
    private _risk: number;
    private _timeout: number;

    private static calculateRisk(filesModifiedFraction: number, faultCount: number, hoursSicnceLastBackup: number) {
        const modificationsFactor = Math.floor(filesModifiedFraction / 0.25) + 1;
        const faultFactor = faultCount > 4 ? 5 : faultCount + 1;
        const lastBackupTimeFactor =
            hoursSicnceLastBackup >= 6 ? 5 :
                hoursSicnceLastBackup >= 3 ? 4 :
                    hoursSicnceLastBackup >= 1 ? 3 :
                        hoursSicnceLastBackup >= 0.5 ? 2 : 1;

        return modificationsFactor + faultFactor + lastBackupTimeFactor;

    }

    private static calculateTimeout(filesModifiedFraction: number, faultCount: number, hoursSicnceLastBackup: number) {
        const risk = this.calculateRisk(filesModifiedFraction, faultCount, hoursSicnceLastBackup)
        const hours =
            risk >= 10 ? 0.5 :
                risk >= 6 ? 3 :
                    risk >= 3 ? 6 : 24;
        return 1000 * 60 * 60 * hours;
    }

    public updateTimer(files: File[], backupedFilesMap: Record<string, BbFile>, faultCount: number, hoursSicnceLastBackup: number, callback: Function) {
        const modifiedFilesFactor = files.filter(f => !backupedFilesMap[f.title] ||
            !f.modifiedAt.equals(backupedFilesMap[f.title].modifiedAt)).length / Object.keys(backupedFilesMap).length;

        const timeout = BackupRunner.calculateTimeout(modifiedFilesFactor, faultCount, hoursSicnceLastBackup);
        const risk = BackupRunner.calculateRisk(modifiedFilesFactor, faultCount, hoursSicnceLastBackup)

        if(timeout !== this._timeout) {
            this._risk = risk;
            this._timeout = timeout
            this.timer = setTimeout(async () => {
                callback();
                await lastValueFrom(QueryRunner.runSync());
            }, timeout);
        }

    }

    public removeTimer() {
        this.timer = null;
    }

    public get hasTimerSet(): boolean {
        return this.timer !== undefined && this.timer !== null;
    }

    public get timeLeft(): number {
        if (!this.timer) {
            return 0;
        }
        const timeout = this.timer as any;
        return Math.ceil((timeout._idleStart + timeout._idleTimeout - process.uptime() * 1000));
    }

    public static getRisk(files: File[], backupedFilesMap: Record<string, BbFile>, faultCount: number, hoursSicnceLastBackup: number): number {
        const modifiedFilesFactor = files.filter(f => !backupedFilesMap[f.title] || !f.modifiedAt.equals(backupedFilesMap[f.title].modifiedAt)).length / Object.keys(backupedFilesMap).length;
        return this.calculateRisk(modifiedFilesFactor, faultCount, hoursSicnceLastBackup)
    }

    public get cachedRisk(): number {
        return this._risk;
    }

    public get cachedTimeout(): number {
        return this._timeout;
    }
    
    public get nextBackupTime() {
        return DateTime.now().plus(this.timeLeft).toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS)
    }
}
