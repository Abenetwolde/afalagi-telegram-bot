-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "telegramId" INTEGER NOT NULL,
    "username" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSubmissionId" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Question" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "confidential" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Submission" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Answer" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Reputation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Reputation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "public"."User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "User_lastSubmissionId_key" ON "public"."User"("lastSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_key_key" ON "public"."Question"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Reputation_userId_key" ON "public"."Reputation"("userId");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_lastSubmissionId_fkey" FOREIGN KEY ("lastSubmissionId") REFERENCES "public"."Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Answer" ADD CONSTRAINT "Answer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "public"."Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reputation" ADD CONSTRAINT "Reputation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
