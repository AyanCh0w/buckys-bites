-- Cron uses UTC. Gate on campus time so the job follows daylight saving time.
select cron.schedule('benson-daily-menu','0 7-10 * * *',$job$
  select benson_private.sync_menu()
  where extract(hour from now() at time zone 'America/Los_Angeles') between 0 and 2
    and not exists (
      select from public.sync_runs r join public.cafes c on c.id=r.cafe_id
      where c.source_key='marketplace-2' and r.service_date=(now() at time zone 'America/Los_Angeles')::date
        and r.status='succeeded' and r.raw_payload ? 'dayparts'
    );
$job$);
