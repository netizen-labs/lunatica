alter table public.profiles
  drop constraint if exists profiles_theme_valid;

alter table public.profiles
  alter column theme set default 'light';

alter table public.profiles
  add constraint profiles_theme_valid
  check (theme in ('light', 'dark', 'black'));

-- The refreshed product identity launches in the light theme. Users can still
-- switch back to either dark option from Settings at any time.
update public.profiles
set theme = 'light'
where theme = 'black';
