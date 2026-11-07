/* Configurazione del sito — modifica qui i dati, senza toccare il resto del codice.

   contactEndpoint: indirizzo a cui il modulo di contatto invia i messaggi (POST in formato JSON).
     - Vuoto ('')  → al clic su "Invia" si apre il programma di posta con il messaggio già scritto.
     - Webhook n8n, Formspree, Web3Forms… → il messaggio arriva direttamente, senza aprire la posta.
       Esempio n8n: 'https://tuo-n8n.example.com/webhook/contatti-mb'                              */
window.SITE_CONFIG = {
  contactEndpoint: '',
  // l'email del destinatario non è scritta qui in chiaro: la ricompone protect.js (window.MB_MAIL)
  company: 'MB Consulting di Mario Bruzzese',
  vat: '03504290796',
  seat: 'Reggio Calabria (RC)'
};
