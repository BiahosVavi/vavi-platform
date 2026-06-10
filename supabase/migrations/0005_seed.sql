-- Seed as a migration so `supabase db push` provisions everything in one shot.
-- Idempotent: on conflict do nothing.

insert into projects (slug, name, color, description, context_md, features, targets, sort_order)
values
  (
    'flyson',
    'Flyson',
    '#16a34a',
    'Agriculture drone services in Morocco',
    'Flyson is an agriculture drone services company in Morocco. Services: precision spraying, fertilizer/product spreading, greenhouse shading, remote sensing, orthophotos, tree counting, agricultural data collection. Mission: modernize Moroccan agriculture — help farmers save water, reduce chemical waste, improve productivity. Clients: agricultural companies, cooperatives, institutions, large farms. Values: efficiency, precision, water saving, practical field execution, scalable impact. Currency: MAD. Languages: French for official business, Arabic/Darija locally, English for tech.',
    '{"pipeline": true, "money": true}',
    '{"weekly_revenue_mad": 10000}',
    1
  ),
  (
    'abna-son',
    'Abna Son',
    '#2563eb',
    'AI automation, websites & apps agency',
    'Abna Son is an AI automation, website and app creation company. Offerings: AI agents, n8n automations, API integrations, CRM systems, landing pages, web applications, WhatsApp automation, lead generation workflows, client management systems. Mission: help businesses save time, generate leads, improve follow-up, operate with better systems. Target clients: e-commerce, coaches, influencers, real estate, agencies, local service businesses, SMEs. Currency: MAD.',
    '{"pipeline": true, "money": true}',
    '{"weekly_revenue_mad": 10000}',
    2
  ),
  (
    'personal-brand',
    'Personal Brand',
    '#d97706',
    'Content & audience: AI, drones, Moroccan entrepreneurship',
    'Personal brand of Sohaib LAALIMI: Moroccan aerospace engineer and serial entrepreneur. Content focus: AI and business, drones and automation, entrepreneurship in Morocco, building companies from scratch, practical execution, lessons from Flyson and Abna Son, systems and discipline. Tone: direct, smart, ambitious, practical, honest, Moroccan but internationally minded.',
    '{"pipeline": false, "money": true}',
    '{}',
    3
  )
on conflict (slug) do nothing;

insert into metric_definitions (project_id, key, name, unit, aggregation, quick_increment, sort_order)
select p.id, m.key, m.name, m.unit, m.aggregation::metric_aggregation, m.quick_increment, m.sort_order
from (
  values
    ('flyson', 'missions_flown', 'Missions flown', 'missions', 'sum', 1, 1),
    ('flyson', 'hectares_treated', 'Hectares treated', 'ha', 'sum', null, 2),
    ('abna-son', 'projects_delivered', 'Projects delivered', 'projects', 'sum', 1, 1),
    ('personal-brand', 'posts_published', 'Posts published', 'posts', 'sum', 1, 1),
    ('personal-brand', 'followers_total', 'Followers (total)', 'followers', 'last', null, 2)
) as m(slug, key, name, unit, aggregation, quick_increment, sort_order)
join projects p on p.slug = m.slug
on conflict (project_id, key) do nothing;
