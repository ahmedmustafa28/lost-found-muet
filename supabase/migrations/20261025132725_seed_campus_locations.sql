-- The campus locations a report can point to (DEVELOPMENT.md D-16, 9.2).
--
-- Keys are permanent once reports use them (item_reports.location_key
-- references them), so never rename one: retire it with is_active = false
-- and add a new row instead. Labels can be changed in a later migration.
-- sort_order goes up in tens, so a new location can be placed between two
-- others without renumbering. "Other" stays last.

insert into public.campus_locations (key, label, sort_order) values
  ('library',                     'MUET Library',                                              10),
  ('stc',                         'Student Teacher Center (STC)',                              20),
  ('cafeteria',                   'Cafeteria or canteen',                                      30),
  ('sports_grounds',              'Sports grounds and courts',                                 40),
  ('gym',                         'Gym and Fitness Center',                                    50),
  ('university_bus',              'University bus (point)',                                    60),
  ('main_gate',                   'Main gate',                                                 70),
  ('mosque',                      'Mosque',                                                    80),
  ('admin_block',                 'Admin block',                                               90),
  ('muistd',                      'Institute of Science, Technology and Development (MUISTD)', 100),
  ('dept_architecture',           'Architecture Department',                                   110),
  ('dept_biomedical',             'Biomedical Engineering Department',                         120),
  ('dept_chemical',               'Chemical Engineering Department',                           130),
  ('dept_city_regional_planning', 'City and Regional Planning Department',                     140),
  ('dept_civil',                  'Civil Engineering Department',                              150),
  ('dept_computer_systems',       'Computer Systems Engineering Department',                   160),
  ('dept_electrical',             'Electrical Engineering Department',                         170),
  ('dept_electronic',             'Electronic Engineering Department',                         180),
  ('dept_environmental',          'Environmental Engineering Department',                      190),
  ('dept_industrial_management',  'Industrial and Management Engineering Department',          200),
  ('dept_mechanical',             'Mechanical Engineering Department',                         210),
  ('dept_mechatronics',           'Mechatronics Engineering Department',                       220),
  ('dept_metallurgy_materials',   'Metallurgy and Materials Engineering Department',           230),
  ('dept_mining',                 'Mining Engineering Department',                             240),
  ('dept_petroleum_gas',          'Petroleum and Natural Gas Engineering Department',          250),
  ('dept_software',               'Software Engineering Department',                           260),
  ('dept_telecommunication',      'Telecommunication Engineering Department',                  270),
  ('dept_textile',                'Textile Engineering Department',                            280),
  ('hostel_sachal_sarmast',       'Sachal Sarmast Boys Hostel',                                290),
  ('hostel_abdul_qadeer_khan',    'Abdul Qadeer Khan Afghan Boys Hostel',                      300),
  ('hostel_hisamuddin_rashidi',   'Pir Hisamuddin Shah Rashidi Boys Hostel',                   310),
  ('hostel_abdul_majeed_sindhi',  'Shaikh Abdul Majeed Sindhi Boys Hostel',                    320),
  ('hostel_hyder_bux_jatoi',      'Hyder Bux Jatoi Boys Hostel',                               330),
  ('hostel_gm_syed',              'G M Syed Boys Hostel',                                      340),
  ('hostel_elsa_kazi',            'Elsa Kazi Girls Hostel',                                    350),
  ('hostel_benazir_bhutto',       'Mohtrama Shaheed Benazir Bhutto Girls Hostel',              360),
  ('hostel_bakhtawar',            'Bakhtawar Girls Hostel',                                    370),
  ('other',                       'Other',                                                     380);
