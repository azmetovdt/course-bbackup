import { BbFile, File, QueryRunner } from "./queryRunner";

import { DateTime } from "luxon";
import { lastValueFrom } from "rxjs";

export class BackupRunner {
    private lastBackupTime: DateTime = DateTime.now();
    private timer: NodeJS.Timeout;
    private _risk: number;
    private _timeout: number;

    private calculateRisk(filesModifiedFraction: number, faultCount: number) {
        const hoursSicnceLastBackup = this.hoursSinceBackup;
        const modificationsFactor = Math.floor(filesModifiedFraction / 0.25) + 1;
        const faultFactor = faultCount > 4 ? 5 : faultCount + 1;
        const lastBackupTimeFactor =
            hoursSicnceLastBackup >= 6 ? 5 :
                hoursSicnceLastBackup >= 3 ? 4 :
                    hoursSicnceLastBackup >= 1 ? 3 :
                        hoursSicnceLastBackup >= 0.5 ? 2 : 1;
        return modificationsFactor + faultFactor + lastBackupTimeFactor;

    }

    private calculateTimeout(filesModifiedFraction: number, faultCount: number) {
        const risk = this.calculateRisk(filesModifiedFraction, faultCount)
        const hours =
            risk >= 10 ? 0.5 :
                risk >= 6 ? 3 :
                    risk >= 3 ? 6 : 24;
        return 1000 * 60 * 60 * hours;
    }

    public updateTimer(files: File[], backupedFilesMap: Record<string, BbFile>, faultCount: number, callback: Function) {
        const modifiedFilesFactor = files.filter(f =>
            f.title.trim().length &&
            (!backupedFilesMap[f.title] || !f.modifiedAt.equals(backupedFilesMap[f.title].modifiedAt))
        ).length / Object.keys(backupedFilesMap).length;
        const timeout = this.calculateTimeout(modifiedFilesFactor, faultCount);
        const risk = this.calculateRisk(modifiedFilesFactor, faultCount)
        if (timeout !== this._timeout) {
            this._risk = risk;
            this._timeout = timeout
            this.timer = setTimeout(async () => {
                callback();
                this.lastBackupTime = DateTime.now();
                await lastValueFrom(QueryRunner.runSync(this));
            }, timeout);
        }
    }

    public removeTimer() {
        this.timer = null;
    }

    public setLastBackupTime() {
        this.lastBackupTime = DateTime.now();
    }

    public get hoursSinceBackup() {
        return this.lastBackupTime.diffNow('hours').toObject().hours;
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

    public getRisk(files: File[], backupedFilesMap: Record<string, BbFile>, faultCount: number): number {
        const modifiedFilesFactor = files.filter(f =>
            f.title.trim().length &&
            (!backupedFilesMap[f.title] || !f.modifiedAt.equals(backupedFilesMap[f.title].modifiedAt))
        ).length / Object.keys(backupedFilesMap).length;
        return this.calculateRisk(modifiedFilesFactor, faultCount)
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
