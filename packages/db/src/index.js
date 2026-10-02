// The one place apps get the database client from. The schema lives in ../prisma/schema.prisma,
// and the client (with types for every model) is generated from it on install (`prisma generate`).
export { Prisma, PrismaClient } from "@prisma/client";
