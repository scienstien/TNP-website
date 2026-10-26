# T&P official data import templates

The Admin Data Management page (`/admin/data-management`) provides versioned CSV and Excel templates, a current reference workbook, validation, a row-by-row preview and an explicit confirmation step. This guide and `lib/import/templates.ts` define the same version 1 format.

Only ADMIN or SUPERADMIN users may import. A SUPERADMIN must select one department; `All departments` is read-only. Companies and placement cycles are institute-wide, while cohorts, enrollments, registrations and offers are checked against the selected department. Import one file at a time in this order: **companies → cycles → cohorts → students → offers**. Use the current reference workbook for exact department, degree, programme, classification, cycle, company, drive and role values.

## File rules and review

- CSV must be UTF-8 with a single exact header row. Excel uploads must be `.xlsx`; edit the sheet named exactly for the selected dataset. The `Instructions` and `Examples` sheets in downloaded workbooks are documentation and are never imported. Excel formulas, merged cells, hyperlinks, hidden rows/columns, unexpected sheets, extra columns and non-text dates are rejected.
- Keep every column, including optional columns, in the exact spelling, case and order below. The importer never guesses mappings. Do not add notes, title rows, extra columns, blank data rows or metadata.
- Maximum file size is 2 MB and maximum data rows is 5,000. Split larger sources into files and do not split duplicate keys across files.
- Text is trimmed. Company and student names also collapse repeated whitespace and normalize Unicode. Department codes are trimmed and lower-cased. All other codes and enum values are exact; aliases are not inferred.
- Blank optional values mean SQL `NULL`. For existing company and cycle updates, a blank optional cell clears that value; inspect the before/after preview. Dates must be real `YYYY-MM-DD` strings; years are four digit integers. Compensation values are plain nonnegative decimals without currency symbols or separators.
- Each row in the Excel `Examples` sheet starts with the reserved `EXAMPLE_ONLY:` marker. Do not copy example rows into the data sheet; marked values are rejected. The examples are fictional.
- A duplicate key in one file is an error. Exact existing records are skipped. Only the update behavior stated below is allowed. No absent record is deleted and historical years are preserved. Any validation or database constraint error prevents the entire file from committing.
- Preview does not persist changes. Confirm only after reviewing all row actions, normalized values, prior values, selected department and counts. Confirmation rechecks the user, department, file and database state and writes the whole file and import-history entry in one transaction. A preview expires after ten minutes.

## Dataset formats

“Required” describes required input fields. Empty optional values are NULL. Fields and order are exact.

### 1. Companies (`companies`)

Header: `company_name,description,remarks`

| Column | Required | Type and accepted value | Relationship / behavior |
| --- | --- | --- | --- |
| `company_name` | Yes | Text; 1–200 characters after whitespace normalization | Stable match is exact canonical name. Case/space variants of existing names are errors; other ambiguous names require manual review. |
| `description` | No | Text | Stored in `companies.domain`; descriptive only, never a chart/filter field. Blank clears an existing value. |
| `remarks` | No | Text | Blank clears an existing value. Legacy global HR and PVR fields are untouched. |

Companies are shared institute-wide. Existing exact names update description and remarks. Do not create drives or roles from company rows.

### 2. Placement cycles (`cycles`)

Header: `cycle_code,starts_on,ends_on`

| Column | Required | Type and accepted value | Relationship / behavior |
| --- | --- | --- | --- |
| `cycle_code` | Yes | Text; exact unique cycle code | Stable match key. |
| `starts_on` | No | Real ISO date `YYYY-MM-DD` | Optional; no date range is inferred. Blank clears an existing date. |
| `ends_on` | No | Real ISO date `YYYY-MM-DD` | Optional; may not precede `starts_on` when both are present. Blank clears an existing date. |

Cycles are shared institute-wide, may overlap and may have no dates. Membership must be explicit; never infer it from a year or date.

### 3. Graduating cohorts (`cohorts`)

Header: `department_code,degree_code,specialization,graduation_year`

| Column | Required | Type and accepted value | Relationship / behavior |
| --- | --- | --- | --- |
| `department_code` | Yes | Existing department code; lower-case normalization | Must equal the selected department. No aliases. |
| `degree_code` | Yes | Exact existing degree code | Must reference a preconfigured degree. |
| `specialization` | No | Exact existing programme specialization; blank only for unspecialized programmes | For PG, specialization is required. Programme must already exist. |
| `graduation_year` | Yes | Four digit integer, 1000–9999 | Cohort year, not placement cycle year. |

This template creates only a cohort for an exact existing department/degree/specialization programme. It does not create departments, degrees or programmes. An existing exact cohort is skipped.

### 4. Students and cycle registration (`students`)

Header: `roll_number,student_name,department_code,degree_code,specialization,graduation_year,admission_year,gender_code,reservation_category_code,cycle_code,registration_status`

| Column | Required | Type and accepted value | Relationship / behavior |
| --- | --- | --- | --- |
| `roll_number` | Yes | Integer, exactly nine digits (100000000–999999999) | Globally unique, immutable enrollment key. |
| `student_name` | Yes | Text, 1–100 characters; Unicode letters/marks, spaces, apostrophes, periods and hyphens; at least one letter | Identifies the person only alongside the roll. The importer never merges different rolls by name. |
| `department_code` | Yes | Existing department code; lower-case normalization | Must equal selected department. |
| `degree_code` | Yes | Exact existing degree code | References the existing degree. |
| `specialization` | PG: yes; UG: per existing programme | Exact specialization or blank for unspecialized programme | Resolves an existing programme; no aliases. |
| `graduation_year` | Yes | Four digit integer, 1000–9999 | Resolves an existing programme cohort. |
| `admission_year` | No | Four digit integer, 1000–9999; no later than graduation year | Enrollment field; blank remains NULL. |
| `gender_code` | No | Exact existing `gender_types.code` | No classification inference. |
| `reservation_category_code` | No | Exact existing `reservation_categories.code` | No classification inference. |
| `cycle_code` | Yes | Exact existing placement cycle code | Explicit cycle; it is not inferred from dates or cohort year. |
| `registration_status` | Yes | Exactly `REGISTERED` or `UNREGISTERED` | Must match the official roster; no default. `UNREGISTERED` includes opt-outs and academic ineligibility. |

The programme and cohort must already exist (import the cohort file first). New rolls create a student, enrollment, cycle/cohort association and registration. Existing rolls must have matching identity and academic fields; only the registration status may be updated. `roll_number + cycle_code` must be unique in the file. One person with separate UG and PG enrollments cannot be inferred or linked by this importer.

### 5. Final offers (`offers`)

Header: `roll_number,cycle_code,company_name,drive_id,role_id,package_lpa,monthly_stipend_inr,offer_type,offer_date`

| Column | Required | Type and accepted value | Relationship / behavior |
| --- | --- | --- | --- |
| `roll_number` | Yes | Nine digit integer | Existing enrollment in selected department; only one final offer per enrollment across all cycles. |
| `cycle_code` | Yes | Exact existing cycle code | Must have explicit `REGISTERED` participation for this roll and cycle. |
| `company_name` | Yes | Exact existing canonical company name | Import or verify company first. |
| `drive_id` | No | UUID of an existing drive | Drive must match the company and cycle. Blank is allowed for historical offers. |
| `role_id` | No | UUID of an existing drive role | Must belong to `drive_id`; a role requires a drive. |
| `package_lpa` | No | Nonnegative plain decimal | Actual annual compensation in INR lakhs/year; no exponent, sign, currency symbol or comma. |
| `monthly_stipend_inr` | No | Nonnegative plain decimal | Actual monthly stipend in INR, kept separate from LPA. |
| `offer_type` | No | Exactly `PPO`, `FTE` or `FTE+6month` | Blank remains NULL. |
| `offer_date` | No | Real ISO date `YYYY-MM-DD` | Does not determine cycle membership. |

Identical existing offers are skipped. A conflicting existing final offer, including one in another cycle, is an error for manual review; no offer is silently overwritten. Missing drive, role, amount, type or date stays NULL.

## Example rows

Examples are fictional and are included only on the Excel `Examples` sheet. The reserved marker makes every row invalid if copied to the import sheet.

```csv
company_name,description,remarks
EXAMPLE_ONLY: Example Manufacturing Ltd,Fictional description,Fictional example
```

```csv
cycle_code,starts_on,ends_on
EXAMPLE_ONLY: EXAMPLE-2027,2026-08-01,2027-06-30
```

```csv
department_code,degree_code,specialization,graduation_year
EXAMPLE_ONLY: mme,B.Tech,,2027
```

```csv
roll_number,student_name,department_code,degree_code,specialization,graduation_year,admission_year,gender_code,reservation_category_code,cycle_code,registration_status
EXAMPLE_ONLY: 987654321,Example Student,mme,B.Tech,,2027,2023,,,EXAMPLE-2027,REGISTERED
```

```csv
roll_number,cycle_code,company_name,drive_id,role_id,package_lpa,monthly_stipend_inr,offer_type,offer_date
EXAMPLE_ONLY: 987654321,EXAMPLE-2027,Example Manufacturing Ltd,,,12.5,,FTE,2026-12-01
```

## T&P Cell preparation checklist

1. Reconcile source rosters and historical registration with the authorized department administrator. Do not fabricate `REGISTERED`/`UNREGISTERED` values or classifications.
2. Download fresh templates and the current reference workbook from Data Management. Verify department, degree, specialization, cohort, code and company values against approved institutional records.
3. Normalize company naming with the administrator; ambiguous near matches must be resolved before upload. Do not use domains as company match keys.
4. Prepare one dataset per file in the required order. Preserve source records absent from later files; imports are add/update operations, not replacement snapshots.
5. Review every preview row and count, especially registration updates, company/cycle clears and skipped rows. Resolve all errors at source, regenerate preview and confirm only when reconciled.
6. After confirmation, verify dashboard and historical comparison results for the intended cycles and department. The application records actor, dataset, time, department, file fingerprint and counts, but does not retain uploaded files.
