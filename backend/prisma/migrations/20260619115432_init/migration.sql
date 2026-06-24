-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'AGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('GENERAL_QUERY', 'TECHNICAL', 'BILLING', 'REFUND', 'ACCOUNT_ACCESS', 'OTHER');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('CUSTOMER', 'AGENT', 'AI');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'AGENT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "category" "TicketCategory",
    "priority" "Priority",
    "severity" "Severity",
    "assigned_to_id" TEXT,
    "email_thread_id" TEXT,
    "is_ai_handled" BOOLEAN NOT NULL DEFAULT false,
    "last_customer_reply_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sender_type" "SenderType" NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBaseFile" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBaseFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RoundRobinState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "last_agent_id" TEXT,

    CONSTRAINT "RoundRobinState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_email_thread_id_key" ON "Ticket"("email_thread_id");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeBaseFile_filename_key" ON "KnowledgeBaseFile"("filename");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
