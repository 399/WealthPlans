INSERT INTO instrument
  (symbol, name, asset_type, exchange, currency, created_at)
VALUES
  ('000001.XSHG', '上证指数', 'index', 'XSHG', 'CNY', '2026-07-27T08:15:00.000Z'),
  ('001316.OF', '安信稳健增值混合A', 'fund', NULL, 'CNY', '2026-07-27T08:15:00.000Z');

INSERT INTO daily_value (
  symbol, value_type, date, open, high, low, close, unit_nav,
  accumulated_nav, adjusted_value, change_percent, volume, turnover,
  source, fetched_at, raw_json
) VALUES
  (
    '000001.XSHG', 'index_close', '2026-07-21',
    '3812.1618', '3864.6002', '3743.3601', '3864.3671',
    NULL, NULL, NULL, '1.7935', '73502192500', '1396517619563.9000',
    'ftshare', '2026-07-27T08:15:00.000Z', '{"seed":true}'
  ),
  (
    '000001.XSHG', 'index_close', '2026-07-22',
    '3839.6654', '3884.4352', '3839.6654', '3867.0336',
    NULL, NULL, NULL, '0.0690', '61425521500', '1258148128160.0000',
    'ftshare', '2026-07-27T08:15:00.000Z', '{"seed":true}'
  ),
  (
    '000001.XSHG', 'index_close', '2026-07-23',
    '3868.0871', '3878.8318', '3851.7058', '3876.7774',
    NULL, NULL, NULL, '0.2520', '56212260100', '1025875517700.1000',
    'ftshare', '2026-07-27T08:15:00.000Z', '{"seed":true}'
  ),
  (
    '000001.XSHG', 'index_close', '2026-07-24',
    '3853.6316', '3861.0404', '3808.6359', '3814.1978',
    NULL, NULL, NULL, '-1.6142', '50820390500', '915366398292.6000',
    'ftshare', '2026-07-27T08:15:00.000Z', '{"seed":true}'
  ),
  (
    '000001.XSHG', 'index_close', '2026-07-27',
    '3808.9032', '3858.3097', '3793.4489', '3858.245',
    NULL, NULL, NULL, '1.1548', '50487945400', '1031312143065.2000',
    'ftshare', '2026-07-27T08:15:00.000Z', '{"seed":true}'
  ),
  (
    '001316.OF', 'unit_nav', '2026-07-20',
    NULL, NULL, NULL, NULL, '1.8151', '1.8701', '1.90085',
    '0.676688', NULL, NULL, 'ftshare', '2026-07-27T08:15:00.000Z', '{"seed":true}'
  ),
  (
    '001316.OF', 'unit_nav', '2026-07-21',
    NULL, NULL, NULL, NULL, '1.8114', '1.8664', '1.896976',
    '-0.203846', NULL, NULL, 'ftshare', '2026-07-27T08:15:00.000Z', '{"seed":true}'
  ),
  (
    '001316.OF', 'unit_nav', '2026-07-22',
    NULL, NULL, NULL, NULL, '1.8148', '1.8698', '1.900536',
    '0.1877', NULL, NULL, 'ftshare', '2026-07-27T08:15:00.000Z', '{"seed":true}'
  ),
  (
    '001316.OF', 'unit_nav', '2026-07-23',
    NULL, NULL, NULL, NULL, '1.8165', '1.8715', '1.902316',
    '0.093674', NULL, NULL, 'ftshare', '2026-07-27T08:15:00.000Z', '{"seed":true}'
  ),
  (
    '001316.OF', 'unit_nav', '2026-07-24',
    NULL, NULL, NULL, NULL, '1.8108', '1.8658', '1.896347',
    '-0.31379', NULL, NULL, 'ftshare', '2026-07-27T08:15:00.000Z', '{"seed":true}');
