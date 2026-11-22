# Member demographic visualization sample

The chairman demographic profile and barangay map use approved member records
from the database. To make every occupation category visible during a local
demo, the repository includes an opt-in fixture script.

The script is read-only by default and only targets approved members whose
occupation is blank. It does not overwrite an existing occupation and does not
run during application startup.

```powershell
npm run db:seed:demographics
npm run db:seed:demographics -- --apply
npm run db:seed:demographics -- --verify
```

The first command previews the member assignments. The second command assigns
one member to each occupation supported by the membership form:

- Farmer
- Fisherfolk
- Livestock raiser
- Poultry raiser
- Aquaculture worker
- Agricultural worker
- Fish vendor
- Entrepreneur
- Government employee
- Private employee
- Self-employed
- Student
- Retired
- Unemployed

After applying the fixture, refresh the Chairman dashboard. The demographic
profile updates from the same approved-member data, and the barangay map popup
shows the occupation counts for the selected barangay. The script will stop
without writing if there are fewer than 14 approved members with blank
occupations.

The `--verify` mode prints the current approved-member occupation counts without
changing the database.
