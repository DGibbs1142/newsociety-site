// admin-push.html's only script. The admin secret is typed fresh each visit
// (never stored) and sent as a header to push-send.mts, which is the actual
// gate — this page is just the form around that request.
document.getElementById('pushAdminForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById('pushAdminSubmit');
  const status = document.getElementById('pushAdminStatus');
  const secret = document.getElementById('adminSecret').value;
  const title = document.getElementById('pushTitle').value.trim();
  const body = document.getElementById('pushBody').value.trim();
  const url = document.getElementById('pushUrl').value.trim() || '/';

  submitBtn.disabled = true;
  status.textContent = 'Sending…';

  try{
    const res = await fetch('/api/push-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ title, body, url })
    });
    const data = await res.json().catch(() => ({}));
    if(!res.ok){
      status.textContent = 'Failed: ' + (data.error || res.status);
    }else{
      status.textContent = `Sent to ${data.sent} subscriber(s). ${data.failed ? data.failed + ' failed, ' + data.removed + ' removed as dead.' : ''}`;
    }
  }catch(err){
    status.textContent = 'Failed: network error';
  }finally{
    submitBtn.disabled = false;
  }
});
