-- end_date es exclusivo para todos los planes. Los paquetes anteriores sin fecha
-- conservan sus condiciones; las ventas nuevas exigen fecha límite en el servicio.
DROP TRIGGER pos_one_plan;
CREATE TRIGGER pos_one_plan BEFORE INSERT ON pos_memberships BEGIN
 SELECT CASE WHEN EXISTS(
  SELECT 1 FROM pos_memberships m
  WHERE m.person_id=NEW.person_id AND m.status='active' AND m.id<>NEW.id
   AND ((m.unit<>'sessions' AND m.end_date>NEW.start_date)
     OR (m.unit='sessions' AND m.sessions_remaining>0 AND (m.end_date IS NULL OR m.end_date>NEW.start_date)))
 ) THEN RAISE(ABORT,'POS_ACTIVE_PLAN') END;
END;

DROP TRIGGER pos_access_use;
CREATE TRIGGER pos_access_use AFTER INSERT ON events
WHEN NEW.allowed=1 AND NEW.direction='entry' AND NEW.zone_id='general' AND EXISTS(SELECT 1 FROM people WHERE id=NEW.person_id AND kind='member') BEGIN
 INSERT INTO pos_membership_uses(event_id,membership_id)
 SELECT NEW.id,id FROM pos_memberships WHERE person_id=NEW.person_id AND status='active' AND start_date<=NEW.local_date
  AND ((unit<>'sessions' AND end_date>NEW.local_date)
    OR (unit='sessions' AND sessions_remaining>0 AND (end_date IS NULL OR end_date>NEW.local_date)))
 ORDER BY CASE WHEN unit='sessions' THEN 1 ELSE 0 END,created_at,rowid LIMIT 1;
 UPDATE pos_memberships SET sessions_remaining=sessions_remaining-1 WHERE unit='sessions' AND id=(SELECT membership_id FROM pos_membership_uses WHERE event_id=NEW.id);
END;
