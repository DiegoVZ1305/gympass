-- Activar el cierre diario en instalaciones existentes y en las altas futuras.
-- Las visitas se cierran mediante el mantenimiento habitual con eventos AUTO_CLOSE.
UPDATE settings SET closing_time='23:59' WHERE id=1;
CREATE TRIGGER settings_default_daily_closing AFTER INSERT ON settings
WHEN NEW.closing_time IS NULL BEGIN
 UPDATE settings SET closing_time='23:59' WHERE id=NEW.id;
END;
