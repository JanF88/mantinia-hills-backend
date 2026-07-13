-- Erlaubt dem Admin, archivierte PDFs beim Löschen einer Buchung mitzuentfernen.
create policy dokumente_loeschen on storage.objects
  for delete to authenticated using (bucket_id = 'dokumente');
