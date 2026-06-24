-- Seed the 8 predefined achievements into the master achievements table.
-- Uses ON CONFLICT DO NOTHING so re-running is safe.

insert into public.achievements (name, description, icon, condition) values
  ('Erster Login',        'Melde dich zum ersten Mal an.',                        '🎉', 'first_login'),
  ('Stammgast',           'Melde dich an 7 verschiedenen Tagen an.',              '📅', 'login_7_days'),
  ('Spieler',             'Wähle zum ersten Mal Spiele aus.',                     '🎮', 'first_game'),
  ('Sammler',             'Wähle 5 verschiedene Spiele über alle Sessions.',      '🗂️', 'five_games'),
  ('Gesprächig',          'Sende deine erste Direktnachricht.',                   '💬', 'first_message'),
  ('Sozialer Schmetterling', 'Sende 50 Direktnachrichten.',                       '🦋', 'messages_50'),
  ('Chat-König',          'Sende deine erste Global-Chat-Nachricht.',             '👑', 'first_chat'),
  ('Dauergast',           'Melde dich an 30 verschiedenen Tagen an.',             '🏆', 'login_30_days')
on conflict (condition) do nothing;
