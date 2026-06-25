-- AlterEnum: add new values (Postgres requires separate ALTER TYPE per value)
ALTER TYPE "TicketCategory" ADD VALUE 'DELIVERY';
ALTER TYPE "TicketCategory" ADD VALUE 'MENU';

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);
