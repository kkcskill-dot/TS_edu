-- Run as SYS or SYSTEM only after confirming the PDB/container.
WHENEVER SQLERROR EXIT SQL.SQLCODE
DEFINE lab_user = PERF_LAB
DROP USER &&lab_user CASCADE;
PROMPT PERF_LAB removed.
