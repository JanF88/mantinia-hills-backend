-- Die Edge Function angebot-annehmen (Service-Role) muss Rechnungsnummern ziehen können.
grant execute on function naechste_dokument_nummer(text) to service_role;
