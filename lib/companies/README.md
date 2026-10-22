# Company directory

Company contact creation and updates require an ADMIN (including SUPERADMIN) acting
in a chosen department. Contacts are global company fields. Duplicate-name creation
never overwrites a company. Names are not editable in the directory.

Contact saves touch only `companies`. A `visitDate` key is rejected even when null;
`setVisitDate` and the unused calendar `saveVisit`/`deleteVisit` actions were removed.
The directory displays the earliest dated PPT as read-only text; the shared
`visitDatesByCompany(connection, cycleId)` reader is unchanged. There is no company-wide
PPT/offer ordering rule in company saves. No cycle, drive or event is created by them.

The existing graduating-year directory read remains temporarily until MIG-006;
new company PVR still defaults to No until that task changes it to Unknown.
