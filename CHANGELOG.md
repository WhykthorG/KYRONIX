# Changelog

All notable changes to KYRONIX S.E.N.O will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [CalVer](https://calver.org/) versioning.

## [2026.07.1] - 2026-07-17

### Added
- Unified project from MIMO (KYRONIX) and TCC (EduGest) codebases
- 14 new pages: Internships, InternshipCompanies, TCCProjects, Laboratories, Courses, Certificates, SchoolCalendar, StudentEnrollment, AssessmentsImprovements, ExamCalendar, StudentSchedule, StudentAttendance, StudentInternship, StudentTCC
- Internationalization (i18n) with PT/EN/ES support
- Zustand stores for desktop/mobile shell state
- 72 RBAC permissions (expanded from 57)
- 13 new Supabase migrations
- Netlify included_files for proper serverless bundling
- Comprehensive README with full documentation
- SECURITY_TEST_GUIDE.md
- CHANGELOG.md

### Changed
- Renamed from EduGest to KYRONIX S.E.N.O
- Upgraded from xlsx to exceljs for spreadsheet handling
- Updated netlify.toml with included_files configuration
- Updated docker-compose.yml with KYRONIX branding

### Removed
- @anthropic-ai/sdk (Claude AI integration)
- xlsx library (replaced by exceljs)
- 158 .bak backup files (moved to archive/)
- TCC.rar archive
- Video call features (WebRTC 1:1 calls)
- ClientRuntimeObservability frontend component