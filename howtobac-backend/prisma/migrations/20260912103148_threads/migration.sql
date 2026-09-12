-- CreateTable
CREATE TABLE "threads" (
    "id" UUID NOT NULL,
    "subject" "Subject" NOT NULL,
    "author_id" UUID,
    "title" VARCHAR(120) NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thread_messages" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "author_id" UUID,
    "content" VARCHAR(4000) NOT NULL,
    "reply_to_id" UUID,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thread_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "threads_subject_pinned_last_message_at_idx" ON "threads"("subject", "pinned", "last_message_at");

-- CreateIndex
CREATE INDEX "thread_messages_thread_id_id_idx" ON "thread_messages"("thread_id", "id");

-- AddForeignKey
ALTER TABLE "threads" ADD CONSTRAINT "threads_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "thread_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
