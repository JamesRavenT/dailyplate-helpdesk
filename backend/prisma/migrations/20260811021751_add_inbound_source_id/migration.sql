-- AlterTable
ALTER TABLE "Message" ADD COLUMN "inbound_source_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Message_inbound_source_id_key" ON "Message"("inbound_source_id");
