-- Enforce one status page per custom domain (multiple NULLs allowed).
CREATE UNIQUE INDEX "StatusPage_customDomain_key" ON "StatusPage"("customDomain");
