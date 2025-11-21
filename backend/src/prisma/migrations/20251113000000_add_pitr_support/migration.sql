-- CreateEnum for TransactionLogType
CREATE TYPE "TransactionLogType" AS ENUM ('WAL', 'BINLOG', 'TRANSACTION_LOG', 'OPLOG');

-- CreateEnum for TransactionLogStatus
CREATE TYPE "TransactionLogStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'EXPIRED', 'DELETED', 'ERROR');

-- AlterEnum - Add PITR actions to AuditAction
ALTER TYPE "AuditAction" ADD VALUE 'PITR_RESTORE_START';
ALTER TYPE "AuditAction" ADD VALUE 'PITR_RESTORE_SUCCESS';
ALTER TYPE "AuditAction" ADD VALUE 'PITR_RESTORE_FAIL';
ALTER TYPE "AuditAction" ADD VALUE 'TRANSACTION_LOG_BACKUP';
ALTER TYPE "AuditAction" ADD VALUE 'TRANSACTION_LOG_ARCHIVE';
ALTER TYPE "AuditAction" ADD VALUE 'TRANSACTION_LOG_DELETE';

-- AlterTable BackupJob - Add PITR settings
ALTER TABLE "BackupJob" ADD COLUMN "enableTransactionLogBackup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BackupJob" ADD COLUMN "logBackupIntervalMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "BackupJob" ADD COLUMN "logRetentionDays" INTEGER NOT NULL DEFAULT 7;

-- AlterTable BackupHistory - Add PITR metadata
ALTER TABLE "BackupHistory" ADD COLUMN "recoveryPoint" TEXT;
ALTER TABLE "BackupHistory" ADD COLUMN "canRestoreToPIT" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BackupHistory" ADD COLUMN "minRestoreTime" TIMESTAMP(3);
ALTER TABLE "BackupHistory" ADD COLUMN "maxRestoreTime" TIMESTAMP(3);

-- CreateTable TransactionLog
CREATE TABLE "TransactionLog" (
    "id" SERIAL NOT NULL,
    "databaseId" INTEGER NOT NULL,
    "backupJobId" INTEGER,
    "logType" "TransactionLogType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "sequenceNumber" TEXT,
    "startLSN" TEXT,
    "endLSN" TEXT,
    "firstTimestamp" TIMESTAMP(3) NOT NULL,
    "lastTimestamp" TIMESTAMP(3),
    "storageType" "StorageType" NOT NULL,
    "cloudStorageId" INTEGER,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "status" "TransactionLogStatus" NOT NULL DEFAULT 'ACTIVE',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionLog_databaseId_idx" ON "TransactionLog"("databaseId");
CREATE INDEX "TransactionLog_backupJobId_idx" ON "TransactionLog"("backupJobId");
CREATE INDEX "TransactionLog_logType_idx" ON "TransactionLog"("logType");
CREATE INDEX "TransactionLog_firstTimestamp_idx" ON "TransactionLog"("firstTimestamp");
CREATE INDEX "TransactionLog_status_idx" ON "TransactionLog"("status");
CREATE INDEX "BackupHistory_canRestoreToPIT_idx" ON "BackupHistory"("canRestoreToPIT");

-- AddForeignKey
ALTER TABLE "TransactionLog" ADD CONSTRAINT "TransactionLog_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES "Database"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionLog" ADD CONSTRAINT "TransactionLog_backupJobId_fkey" FOREIGN KEY ("backupJobId") REFERENCES "BackupJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransactionLog" ADD CONSTRAINT "TransactionLog_cloudStorageId_fkey" FOREIGN KEY ("cloudStorageId") REFERENCES "CloudStorage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
