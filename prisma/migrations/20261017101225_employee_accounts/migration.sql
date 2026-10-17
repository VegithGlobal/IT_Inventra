-- CreateEnum
CREATE TYPE "SystemCategory" AS ENUM ('EMAIL', 'GOOGLE', 'MICROSOFT', 'SOFTWARE', 'CLOUD', 'DEV_TOOLS', 'VPN_NETWORK', 'FINANCE', 'COMMUNICATION', 'SOCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DISABLED', 'DELETED', 'TRANSFERRED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'REVEAL';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_OFFBOARDING';

-- CreateTable
CREATE TABLE "AppSystem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SystemCategory" NOT NULL DEFAULT 'SOFTWARE',
    "loginUrl" TEXT,
    "vendorId" TEXT,
    "offboardingSteps" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AppSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAccount" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "accessLevel" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "personal" BOOLEAN NOT NULL DEFAULT false,
    "grantedAt" DATE,
    "passwordEnc" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closeNote" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppSystem_name_idx" ON "AppSystem"("name");

-- CreateIndex
CREATE INDEX "EmployeeAccount_employeeId_status_idx" ON "EmployeeAccount"("employeeId", "status");

-- CreateIndex
CREATE INDEX "EmployeeAccount_systemId_status_idx" ON "EmployeeAccount"("systemId", "status");

-- AddForeignKey
ALTER TABLE "AppSystem" ADD CONSTRAINT "AppSystem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAccount" ADD CONSTRAINT "EmployeeAccount_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAccount" ADD CONSTRAINT "EmployeeAccount_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "AppSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAccount" ADD CONSTRAINT "EmployeeAccount_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
