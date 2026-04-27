-- ══════════════════════════════════════════════════════════════════════════
-- VIP-PUNKTE-REBALANCE — ×10 für CoD-typische Tiefe
-- ══════════════════════════════════════════════════════════════════════════
-- Lv 15 = 750.000 Punkte (statt 75.000) → echtes Endgame.
-- redeem_vip_ticket bleibt 50 Pkt/Ticket (war "billig"); damit dauert
-- Endgame 15.000 Tickets — passt zu VIP-Daily-Reward + Quest-Drops.
-- ══════════════════════════════════════════════════════════════════════════

update public.vip_tier_thresholds set required_points = case vip_level
  when  0 then       0
  when  1 then    1000
  when  2 then    3000
  when  3 then    6000
  when  4 then   10000
  when  5 then   16000
  when  6 then   25000
  when  7 then   40000
  when  8 then   60000
  when  9 then   90000
  when 10 then  130000
  when 11 then  180000
  when 12 then  250000
  when 13 then  350000
  when 14 then  500000
  when 15 then  750000
  else required_points end
where vip_level between 0 and 15;
