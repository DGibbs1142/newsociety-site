// Get Involved runs one Netlify form for four kinds of people, so only the
// questions for the chosen role are shown. Hidden groups are disabled —
// disabled inputs are neither validated nor submitted — and a field marked
// data-required only becomes required while its group is visible. Without
// JavaScript every group shows and nothing role-specific is required, so
// the form still submits.
(function(){
  const form = document.querySelector('form[name="get-involved"]');
  if(!form) return;
  const picker = form.querySelector('select[name="role"]');
  const groups = [...form.querySelectorAll('[data-role]')];

  function apply(){
    const key = picker.selectedOptions[0] ? picker.selectedOptions[0].dataset.key : '';
    groups.forEach(group => {
      const on = group.dataset.role === key;
      group.hidden = !on;
      group.querySelectorAll('input, select, textarea').forEach(el => {
        el.disabled = !on;
        if(el.hasAttribute('data-required')) el.required = on;
      });
    });
  }

  // Deep links like get-involved.html?role=press preselect a role.
  const wanted = new URLSearchParams(location.search).get('role');
  const match = [...picker.options].find(o => o.dataset.key && o.dataset.key === wanted);
  if(match) picker.value = match.value;

  picker.addEventListener('change', apply);
  apply();
})();
