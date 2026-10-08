const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../admin/js/core.js');

const setup = (day = '2026-09-15') => {
  let now = new Date(`${day}T10:00:00`);
  const admin = A.createAdmin(A.memoryStorage(), () => now);
  admin.setDay = (d) => { now = new Date(`${d}T10:00:00`); };
  return admin;
};
const byName = (admin, name) => admin.state.items.find((i) => i.name === name);

test('default products, inventory and incentives', () => {
  const a = setup();
  const inj = a.itemsOf('injection').map((i) => i.name);
  assert.deepEqual(inj, ['Mounjaro 2.5mg', 'Mounjaro 5mg', 'Mounjaro 10mg', 'Mounjaro 15mg',
    'Wegovy 0.25mg', 'Wegovy 1mg', 'Wegovy 2.4mg', 'Ozempic 0.25mg', 'Ozempic 1mg']);
  const cats = a.state.categories.map((c) => c.name);
  for (const c of ['Needles', 'Alcohol Swabs', 'Insulin Syringes', 'Ice Gel Packs', 'Travel Bags', 'Protein']) assert.ok(cats.includes(c), c);
  assert.equal(a.state.settings.incentive.injection, 1000);
  assert.equal(a.state.settings.incentive.protein, 500);
  assert.deepEqual(a.state.settings.dietPlans.map((p) => [p.name, p.incentive]), [['1 Month', 1000], ['3 Month', 2000]]);
  assert.equal(A.SHEETS.length, 15);
  assert.deepEqual(a.state.settings.renewalDays, [75, 90]);
  assert.equal(a.state.settings.consultFee, 1000);
});

test('incentive split: single, 50-50, custom and rounding', () => {
  assert.deepEqual(A.splitIncentive(1000, [{ memberId: 'a', pct: 100 }]), [{ memberId: 'a', pct: 100, amount: 1000 }]);
  assert.deepEqual(A.splitIncentive(1000, [{ memberId: 'a', pct: 50 }, { memberId: 'b', pct: 50 }]).map((x) => x.amount), [500, 500]);
  assert.deepEqual(A.splitIncentive(2000, [{ memberId: 'a', pct: 70 }, { memberId: 'b', pct: 30 }]).map((x) => x.amount), [1400, 600]);
  const odd = A.splitIncentive(1000, [{ memberId: 'a', pct: 1 }, { memberId: 'b', pct: 2 }]);
  assert.equal(odd[0].amount + odd[1].amount, 1000);
});

test('injection sale: stock out, incentive, revenue, new then renewal', () => {
  const a = setup();
  const m = a.saveMember({ name: 'Murshida', designation: 'Counsellor', salary: 25000 });
  const pen = byName(a, 'Mounjaro 15mg');
  assert.throws(() => a.saveSale({ type: 'injection', patientName: 'Asha', mobile: '98765 43210', itemId: pen.id, amount: 17000, refId: m.id }), /in stock/);
  a.adjustStock(pen.id, 3, 'count');
  const s1 = a.saveSale({ type: 'injection', patientName: 'Asha', mobile: '98765 43210', itemId: pen.id, amount: 17000, refId: m.id, date: '2026-09-01' });
  assert.equal(s1.patientType, 'new');
  assert.equal(s1.incentive, 1000);
  assert.equal(a.stockOf(pen.id), 2);
  const s2 = a.saveSale({ type: 'injection', patientName: 'Asha', mobile: '+91 9876543210', itemId: pen.id, amount: 17000, refId: m.id, date: '2026-09-10' });
  assert.equal(s2.patientType, 'renewal');
  assert.equal(a.state.patients.length, 1, 'same mobile = same patient');
  const d = a.dashboard(A.rangeFor('month', '2026-09-15'));
  assert.equal(d.sales.orders, 2);
  assert.equal(d.sales.revenue, 34000);
  assert.equal(d.sales.injection, 34000);
  assert.equal(d.patients.new, 1);
  assert.equal(d.patients.renewal, 1);
  assert.equal(d.team.incentives, 2000);
  assert.equal(d.team.top.name, 'Murshida');
  assert.equal(d.stock.injection, 1);
  a.deleteSale(s2.id);
  assert.equal(a.stockOf(pen.id), 2, 'deleting a sale returns stock');
});

test('shared reference and incentive status off', () => {
  const a = setup();
  const x = a.saveMember({ name: 'A', salary: 10000 });
  const y = a.saveMember({ name: 'B', salary: 10000, incentiveOn: false });
  const plan = a.state.settings.dietPlans.find((p) => p.name === '3 Month');
  const s = a.saveSale({ type: 'diet', patientName: 'Ravi', planId: plan.id, amount: 6000, refId: x.id, sharedId: y.id, sharePct: 40 });
  assert.deepEqual(s.splits.map((v) => [v.name, v.pct, v.amount]), [['A', 60, 1200], ['B', 40, 0]]);
  assert.equal(s.incentive, 1200);
});

test('protein incentive per sale, product override, settings change applies to new sales only', () => {
  const a = setup();
  const m = a.saveMember({ name: 'M', salary: 0 });
  const prot = byName(a, 'Protein Sachets');
  a.adjustStock(prot.id, 100);
  const s1 = a.saveSale({ type: 'protein', patientName: 'P', itemId: prot.id, qty: 30, amount: 3000, refId: m.id });
  assert.equal(s1.incentive, 500);
  a.updateSettings({ incentive: { injection: 1000, protein: 300 } });
  const s2 = a.saveSale({ type: 'protein', patientName: 'Q', itemId: prot.id, qty: 10, amount: 1000, refId: m.id });
  assert.equal(s2.incentive, 300);
  assert.equal(a.state.sales[0].incentive, 500);
  const pen = byName(a, 'Wegovy 2.4mg');
  a.saveItem({ ...pen, incentive: 1500 });
  a.adjustStock(pen.id, 2);
  assert.equal(a.saveSale({ type: 'injection', patientName: 'R', itemId: pen.id, qty: 2, amount: 50000, refId: m.id }).incentive, 3000);
  assert.equal(a.stockOf(prot.id), 60);
});

test('invoice product matching', () => {
  const a = setup();
  const name = (s, k) => (a.matchItem(s, k) || {}).name;
  assert.equal(name('MOUNJARO KWIKPEN 15 MG/0.5ML', 'injection'), 'Mounjaro 15mg');
  assert.equal(name('Mounjaro 2.5 mg inj', 'injection'), 'Mounjaro 2.5mg');
  assert.equal(name('WEGOVY 2.4MG FLEXTOUCH'), 'Wegovy 2.4mg');
  assert.equal(name('Ozempic 0.25 mg pen'), 'Ozempic 0.25mg');
  assert.equal(name('Alcohol swab 100s'), 'Alcohol Swabs');
  assert.equal(name('BD Insulin Syringe 1ml'), 'Insulin Syringes');
  assert.equal(name('Mounjaro 7.5mg'), undefined, 'no such dose');
  assert.equal(name('Paracetamol 500mg'), undefined);
});

test('purchase adds stock and expense; duplicate invoices are refused', () => {
  const a = setup();
  const pen = byName(a, 'Mounjaro 15mg');
  const p = a.savePurchase({ vendor: 'Pharma Dist', invoiceNo: 'INV-7', date: '2026-09-05',
    lines: [{ itemId: pen.id, qty: 2, rate: 10000, gst: 12, batch: 'B1', expiry: '2027-06' }] });
  assert.equal(a.stockOf(pen.id), 2);
  assert.equal(p.total, 22400);
  const e = a.state.expenses.find((x) => x.ref === p.id);
  assert.equal(e.category, 'Injection Purchase');
  assert.equal(e.amount, 22400);
  assert.throws(() => a.savePurchase({ vendor: 'pharma dist', invoiceNo: 'inv-7', lines: [{ itemId: pen.id, qty: 1 }] }), /already saved/);
  a.deletePurchase(p.id);
  assert.equal(a.stockOf(pen.id), 0);
  assert.equal(a.state.expenses.length, 0);
});

test('salary = salary + incentive; booking expenses; profit', () => {
  const a = setup();
  const m = a.saveMember({ name: 'Murshida', salary: 25000 });
  const plan = a.state.settings.dietPlans[0];
  const pen = byName(a, 'Mounjaro 5mg');
  a.adjustStock(pen.id, 20, '', '2026-09-01');
  for (let i = 0; i < 16; i++) a.saveSale({ type: 'injection', patientName: `P${i}`, itemId: pen.id, amount: 5000, refId: m.id, date: '2026-09-02' });
  a.saveSale({ type: 'diet', patientName: 'D', planId: plan.id, amount: 3000, refId: m.id, date: '2026-09-03' });
  a.saveSale({ type: 'diet', patientName: 'E', planId: plan.id, amount: 3000, refId: m.id, date: '2026-09-03' });
  const row = a.salarySheet('2026-09').find((r) => r.name === 'Murshida');
  assert.deepEqual([row.salary, row.incentive, row.total], [25000, 18000, 43000]);
  a.postSalary('2026-09');
  a.postSalary('2026-09'); // idempotent
  a.saveExpense({ category: 'Rent', amount: 15000, date: '2026-09-01' });
  const f = a.financialReport(A.monthRange('2026-09'));
  assert.equal(f.revenue, 86000);
  assert.equal(f.expenses, 25000 + 18000 + 15000);
  assert.equal(f.profit, 86000 - 58000);
  assert.equal(f.byCategory.Salary, 25000);
  assert.equal(f.byCategory.Incentive, 18000);
});

test('renewal alert at 75 days, overdue at 90', () => {
  const a = setup('2026-01-01');
  const m = a.saveMember({ name: 'Ref' });
  const pen = byName(a, 'Wegovy 1mg');
  a.adjustStock(pen.id, 5, '', '2026-01-01');
  a.saveSale({ type: 'injection', patientName: 'A', mobile: '9000000001', itemId: pen.id, amount: 1, refId: m.id, date: '2026-01-01' });
  a.saveSale({ type: 'injection', patientName: 'B', mobile: '9000000002', itemId: pen.id, amount: 1, refId: m.id, date: '2026-02-10' });
  const r = a.renewals('2026-04-05');
  const get = (n) => r.find((x) => x.name === n);
  assert.equal(get('A').stage, 90);
  assert.equal(get('A').days, 94);
  assert.equal(get('A').ref, 'Ref');
  assert.equal(get('B').stage, 0, '54 days: not yet');
  assert.equal(a.renewals('2026-04-25').find((x) => x.name === 'B').stage, 0, '74 days: not yet');
  assert.equal(a.renewals('2026-04-26').find((x) => x.name === 'B').stage, 75);
  a.markRenewal(get('A').saleId, 90, true);
  assert.equal(a.renewals('2026-04-05').find((x) => x.name === 'A').done, true);
});

test('OPD appointments: fee ₹1000, clinic or online, revenue once paid', () => {
  const a = setup();
  const x = a.saveAppointment({ patientName: 'Ravi', mobile: '9811111111', date: '2026-09-15', time: '10:30', mode: 'clinic' });
  assert.equal(x.fee, 1000);
  assert.equal(x.status, 'booked');
  const y = a.saveAppointment({ patientName: 'Sita', date: '2026-09-15', time: '09:00', mode: 'online', link: 'https://meet.example/abc' });
  assert.throws(() => a.saveAppointment({ patientName: 'Z', date: '2026-09-15', mode: 'home' }), /clinic visit or online/);
  assert.deepEqual(a.appointmentsIn({ from: '2026-09-15', to: '2026-09-15' }).map((v) => v.patientName), ['Sita', 'Ravi'], 'sorted by time');
  let st = a.appointmentStats(A.rangeFor('month', '2026-09-15'));
  assert.deepEqual([st.total, st.clinic, st.online, st.fees, st.unpaid], [2, 1, 1, 0, 2]);
  a.updateAppointment(x.id, { status: 'completed', paid: true, payMethod: 'UPI' });
  a.updateAppointment(y.id, { status: 'cancelled', paid: true });
  st = a.appointmentStats(A.rangeFor('month', '2026-09-15'));
  assert.equal(st.fees, 1000, 'cancelled fee not counted');
  const f = a.financialReport(A.rangeFor('month', '2026-09-15'));
  assert.equal(f.revenueByType.consultation, 1000);
  assert.equal(f.revenue, 1000);
  assert.equal(a.dashboard(A.rangeFor('month', '2026-09-15')).sales.consultation, 1000);
  const rows = a.sheetsData().Appointments;
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[2].slice(0, 12), ['2026-09-15', '10:30', 'Ravi', '9811111111', 'Clinic visit', '', '', '', 1000, 'Paid', 'UPI', 'Completed']);
  assert.equal(a.state.patients.length, 2);
});

test('logins: four roles, named staff logins; older fixed logins and single PIN are migrated', () => {
  const store = A.memoryStorage();
  const old = A.defaultState();
  delete old.accounts; delete old.appointments; delete old.leads; delete old.log;
  old.users = { super: { name: 'Owner', hash: 'h1', salt: 's1', len: 4 }, manager: { name: 'Manager', hash: '', salt: '' }, desk: { name: 'Reception', hash: 'h3', salt: 's3' } };
  old.settings.renewalDays = [60, 90]; old.settings.apiKey = 'sk-x';
  store.setItem(A.KEY, JSON.stringify(old));
  const a = A.createAdmin(store);
  assert.deepEqual(a.state.accounts.map((x) => [x.id, x.role, x.name, x.hash]), [['super', 'super', 'Owner', 'h1'], ['admin', 'admin', 'Admin', ''], ['manager', 'manager', 'Manager', ''], ['desk', 'desk', 'Reception', 'h3']]);
  assert.ok(!('users' in a.state));
  assert.deepEqual(a.state.settings.renewalDays, [75, 90]);
  assert.ok(!('apiKey' in a.state.settings));
  const priya = a.saveAccount({ name: 'Priya', role: 'desk' });
  a.setAccountPin(priya.id, 'hx', 'sx', 6, '482913');
  assert.equal(a.account(priya.id).pin, '482913', 'staff PIN visible to Super Admin');
  a.setAccountPin('super', 'hs', 'ss', 4, '1234');
  assert.equal(a.account('super').pin, '', 'Super Admin PIN never stored in plain text');
  assert.throws(() => a.saveAccount({ name: 'priya', role: 'desk' }), /already has this name/);
  assert.throws(() => a.deleteAccount('super'), /at least one Super Admin/);
  assert.throws(() => a.saveAccount({ id: 'super', name: 'Owner', role: 'manager' }), /at least one Super Admin/);
  a.resetAll();
  assert.equal(a.account(priya.id).hash, 'hx', 'erase keeps logins');
});

test('per-member incentive rates, pay mode and injection kit', () => {
  const a = setup();
  const x = a.saveMember({ name: 'X', salary: 20000, incInjection: 1500, incProtein: '' });
  const y = a.saveMember({ name: 'Y', salary: 15000, payMode: 'incentive' });
  const pen = byName(a, 'Mounjaro 5mg');
  const prot = byName(a, 'Protein Sachets');
  a.adjustStock(pen.id, 5); a.adjustStock(prot.id, 50);
  ['Needles', 'Alcohol Swabs', 'Ice Gel Packs', 'Travel Bags'].forEach((n) => a.adjustStock(byName(a, n).id, 100));
  const s1 = a.saveSale({ type: 'injection', patientName: 'P', itemId: pen.id, qty: 2, amount: 10000, refId: x.id, date: '2026-09-02' });
  assert.equal(s1.incentive, 3000, 'own rate 1500 × 2 pens');
  const s2 = a.saveSale({ type: 'injection', patientName: 'Q', itemId: pen.id, amount: 5000, refId: x.id, sharedId: y.id, date: '2026-09-02' });
  assert.deepEqual(s2.splits.map((v) => v.amount), [750, 500], 'each earns own rate × share');
  assert.equal(a.saveSale({ type: 'protein', patientName: 'R', itemId: prot.id, qty: 10, amount: 1000, refId: x.id, date: '2026-09-02' }).incentive, 500, 'blank = default ₹500');
  // kit per pen: travel bag 1, ice gel 1, swabs 16, needles 2 (3 pens sold)
  assert.equal(a.stockOf(byName(a, 'Travel Bags').id), 97);
  assert.equal(a.stockOf(byName(a, 'Ice Gel Packs').id), 97);
  assert.equal(a.stockOf(byName(a, 'Alcohol Swabs').id), 100 - 48);
  assert.equal(a.stockOf(byName(a, 'Needles').id), 94);
  const r = a.stockReport(null).find((v) => v.name === 'Needles');
  assert.deepEqual([r.used, r.current], [6, 94]);
  a.setKit([{ itemId: byName(a, 'Needles').id, qty: 4 }]);
  a.saveSale({ type: 'injection', patientName: 'S', itemId: pen.id, amount: 5000, refId: x.id, date: '2026-09-02' });
  assert.equal(a.stockOf(byName(a, 'Needles').id), 90, 'edited kit');
  assert.equal(a.stockOf(byName(a, 'Travel Bags').id), 97, 'removed from kit');
  a.deleteSale(s1.id);
  assert.equal(a.stockOf(byName(a, 'Alcohol Swabs').id), 100 - 16, 'kit returns with a deleted sale');
  const sal = a.salarySheet('2026-09');
  const ry = sal.find((v) => v.name === 'Y');
  assert.deepEqual([ry.salary, ry.incentive, ry.total], [0, 500, 500], 'incentive only');
  a.saveMember({ id: y.id, name: 'Y', payMode: 'salary' });
  const ry2 = a.salarySheet('2026-09').find((v) => v.name === 'Y');
  assert.deepEqual([ry2.salary, ry2.incentive, ry2.total], [15000, 0, 15000], 'salary only');
});

test('stock alerts can be switched off; order required below 2 for protein and Mounjaro 10/15mg', () => {
  const a = setup();
  const orderNames = a.orderRequired().map((o) => o.item.name);
  assert.deepEqual(orderNames, ['Mounjaro 10mg', 'Mounjaro 15mg', 'Protein Sachets']);
  a.adjustStock(byName(a, 'Mounjaro 10mg').id, 2);
  assert.ok(!a.orderRequired().some((o) => o.item.name === 'Mounjaro 10mg'), '2 in stock: not below 2');
  const n = a.lowStock().length;
  a.saveItem({ ...byName(a, 'Needles'), alertOff: true });
  assert.equal(a.lowStock().length, n - 1);
  a.updateSettings({ stockAlerts: false });
  assert.equal(a.lowStock().length, 0);
  const day = a.daySummary('2026-09-15');
  assert.ok(day.available.some((x) => x.item.name === 'Mounjaro 10mg'));
  assert.ok(day.notAvailable.some((x) => x.item.name === 'Mounjaro 15mg'));
  assert.deepEqual(day.order.map((o) => o.item.name), ['Mounjaro 15mg', 'Protein Sachets']);
});

test('patients can be edited and deleted', () => {
  const a = setup();
  const m = a.saveMember({ name: 'M' });
  const pen = byName(a, 'Wegovy 1mg');
  a.adjustStock(pen.id, 3);
  a.saveSale({ type: 'injection', patientName: 'Del', mobile: '9000000009', itemId: pen.id, amount: 1, refId: m.id });
  a.saveAppointment({ patientName: 'Del', mobile: '9000000009', date: '2026-09-15', mode: 'clinic' });
  const p = a.state.patients[0];
  a.updatePatient(p.id, { name: 'Deleted Person', mobile: '9000000009' });
  assert.equal(a.state.sales[0].patientName, 'Deleted Person');
  assert.throws(() => a.deletePatient(p.id), /1 sales and 1 appointments/);
  a.deletePatient(p.id, true);
  assert.equal(a.state.patients.length, 0);
  assert.equal(a.state.sales.length, 0);
  assert.equal(a.state.appointments.length, 0);
  assert.equal(a.stockOf(pen.id), 3, 'stock back');
});

test('editable choice lists ("+ Add new")', () => {
  const a = setup();
  a.addListItem('expenseCategories', 'Internet');
  a.saveExpense({ category: 'Internet', amount: 999 });
  a.renameListItem('expenseCategories', 'Internet', 'Wi-Fi');
  assert.equal(a.state.expenses[0].category, 'Wi-Fi');
  assert.equal(a.financialReport(null).byCategory['Wi-Fi'], 999);
  assert.throws(() => a.removeListItem('expenseCategories', 'Salary'), /used by the app/);
  a.addListItem('services', 'PRP therapy');
  assert.ok(a.state.settings.lists.services.includes('PRP therapy'));
  a.addCategory('Glucometer Strips', 'other');
  a.saveItem({ name: 'Strips 50', category: 'Glucometer Strips', kind: 'other' });
  a.renameCategory('Glucometer Strips', 'Strips');
  assert.equal(a.state.items.find((i) => i.name === 'Strips 50').category, 'Strips');
  assert.throws(() => a.deleteCategory('Strips'), /Move or delete/);
});

test('lead management: add, follow-ups, status history, convert to appointment, stats', () => {
  const a = setup();
  a.setActor('Priya');
  const l = a.saveLead({ name: 'Neha', mobile: '98100 00001', source: 'Instagram', interest: 'Mounjaro injection', priority: 'hot', followUp: '2026-09-15' });
  assert.equal(l.status, 'New');
  assert.equal(l.createdBy, 'Priya');
  assert.throws(() => a.saveLead({ name: 'Neha 2', mobile: '9810000001' }), /already has this mobile/);
  a.addLeadActivity(l.id, { type: 'call', text: 'Interested, wants pricing', followUp: '2026-09-17', followTime: '11:00' });
  assert.equal(a.lead(l.id).status, 'Contacted', 'first call moves New → Contacted');
  assert.equal(a.lead(l.id).followUp, '2026-09-17');
  let st = a.leadStats(A.rangeFor('month', '2026-09-15'));
  assert.deepEqual([st.total, st.open, st.hot, st.dueToday], [1, 1, 1, 0]);
  a.saveLead({ name: 'Old', mobile: '9810000002', followUp: '2026-09-10' });
  st = a.leadStats(null);
  assert.equal(st.overdue, 1);
  const res = a.convertLead(l.id, { date: '2026-09-18', time: '10:00', mode: 'online' });
  assert.equal(res.appointment.fee, 1000);
  assert.equal(res.appointment.service, 'Mounjaro injection');
  assert.equal(a.lead(l.id).status, 'Appointment booked');
  assert.equal(a.leadStats(null).won, 1);
  assert.ok(a.lead(l.id).history.map((h) => h.type).join(',').startsWith('created,call,followup'));
  const rows = a.sheetsData().Leads;
  assert.equal(rows.length, 3);
  assert.equal(rows[0].length, rows[1].length);
  a.deleteLead(l.id);
  assert.equal(a.state.leads.length, 1);
});

test('activity log records who changed what', () => {
  const a = setup();
  a.setActor('Admin Aamir');
  a.saveMember({ name: 'Z' });
  a.saveExpense({ category: 'Rent', amount: 100 });
  const last = a.state.log.slice(-2);
  assert.deepEqual(last.map((x) => [x.by, x.action]), [['Admin Aamir', 'Team member added'], ['Admin Aamir', 'Expense added']]);
  const sheet = a.sheetsData()['Activity Log'];
  assert.equal(sheet[1][2], 'Expense added', 'newest first');
});

test('stock report and Google Sheets data', () => {
  const a = setup();
  const m = a.saveMember({ name: 'Z' });
  const pen = byName(a, 'Ozempic 1mg');
  a.saveItem({ ...pen, opening: 4 });
  a.savePurchase({ vendor: 'V', invoiceNo: '1', date: '2026-09-02', lines: [{ itemId: pen.id, qty: 3, rate: 100 }] });
  a.saveSale({ type: 'injection', patientName: 'X', itemId: pen.id, amount: 9000, refId: m.id, date: '2026-09-03' });
  const r = a.stockReport(A.monthRange('2026-09')).find((x) => x.name === 'Ozempic 1mg');
  assert.deepEqual([r.opening, r.purchased, r.sold, r.current], [4, 3, 1, 6]);
  const sheets = a.sheetsData();
  assert.deepEqual(Object.keys(sheets), A.SHEETS);
  assert.equal(sheets['Injection Sales'].length, 2);
  assert.equal(sheets['Injection Sales'][1][4], 'Ozempic 1mg');
  for (const rows of Object.values(sheets)) rows.forEach((row) => assert.equal(row.length, rows[0].length));
});

test('backup round trip keeps device secrets out of the file', () => {
  const a = setup();
  a.updateSettings({ sheetsSecret: 'sheet-secret' });
  a.saveMember({ name: 'Kept' });
  const text = a.exportBackup();
  assert.ok(!text.includes('sheet-secret'));
  const b = setup();
  b.importBackup(text);
  assert.equal(b.state.team[0].name, 'Kept');
  assert.throws(() => b.importBackup('{"x":1}'), /not a Hindivine Admin backup/);
});

test('Google Sheet store: shared data leaves device settings behind and loads back', () => {
  const a = setup();
  a.updateSettings({ sheetsUrl: 'https://x', sheetsSecret: 's1' });
  a.setAccountPin('super', 'h', 'salt', 4);
  a.saveMember({ name: 'Shared' });
  const shared = JSON.parse(JSON.stringify(a.exportState()));
  for (const k of ['sheetsSecret', 'sheetsUrl']) assert.ok(!(k in shared.settings), k);
  assert.equal(shared.accounts.find((x) => x.id === 'super').hash, 'h', 'logins are shared across devices');
  const b = setup();
  b.updateSettings({ sheetsSecret: 's2' });
  const seen = [];
  b.onChange((src) => seen.push(src));
  b.loadState(shared);
  assert.equal(b.state.team[0].name, 'Shared');
  assert.equal(b.state.settings.sheetsSecret, 's2');
  assert.deepEqual(seen, ['remote']);
  assert.throws(() => b.loadState({}), /not readable/);
});

test('product-wise incentive: person + product, product, person, default', () => {
  const a = setup();
  const pen = byName(a, 'Mounjaro 15mg'); const pen5 = byName(a, 'Mounjaro 5mg');
  const m = a.saveMember({ name: 'Riya', incInjection: 1200 });
  const n = a.saveMember({ name: 'Sam' });
  a.adjustStock(pen.id, 10, 'count'); a.adjustStock(pen5.id, 10, 'count');
  const sale = (who, it) => a.saveSale({ type: 'injection', patientName: `P${Math.random()}`, mobile: String(9000000000 + Math.floor(Math.random() * 99999)), itemId: it.id, amount: 10000, refId: who.id }).incentive;
  assert.equal(sale(m, pen), 1200, 'personal rate');
  assert.equal(sale(n, pen), 1000, 'default');
  a.setRate('', pen.id, 1500);
  assert.equal(sale(m, pen), 1500, 'product rate beats personal rate');
  assert.equal(sale(n, pen5), 1000, 'other products unchanged');
  a.setRate(n.id, pen.id, 1800);
  assert.equal(sale(n, pen), 1800, 'person + product wins');
  a.setRate(n.id, pen.id, '');
  assert.equal(sale(n, pen), 1500, 'cleared back to product rate');
  const plan = a.state.settings.dietPlans[0];
  a.setRate(m.id, plan.id, 1300);
  assert.equal(a.saveSale({ type: 'diet', patientName: 'D1', mobile: '9555500001', planId: plan.id, amount: 5000, refId: m.id }).incentive, 1300);
  assert.throws(() => a.setRate(m.id, pen.id, -5), /negative/);
});

test('appointments keep doctor and clinic; lists grow and rename', () => {
  const a = setup();
  assert.ok(a.state.settings.lists.doctors.length >= 1);
  const ap = a.saveAppointment({ patientName: 'Kiran', mobile: '9800011111', date: '2026-09-15', time: '10:00', mode: 'clinic', doctor: 'Dr. Mehta', branch: 'Salt Lake' });
  assert.equal(ap.doctor, 'Dr. Mehta'); assert.equal(ap.branch, 'Salt Lake');
  assert.ok(a.state.settings.lists.doctors.includes('Dr. Mehta'));
  assert.ok(a.state.settings.lists.clinics.includes('Salt Lake'));
  a.renameListItem('doctors', 'Dr. Mehta', 'Dr. R. Mehta');
  assert.equal(a.appointment(ap.id).doctor, 'Dr. R. Mehta');
  a.removeListItem('clinics', 'Salt Lake');
  assert.ok(!a.state.settings.lists.clinics.includes('Salt Lake'));
  const rows = a.sheetsData().Appointments;
  assert.equal(rows[0][6], 'Doctor'); assert.equal(rows[1][6], 'Dr. R. Mehta');
});

test('patient age with sales, vitals and BMI with appointments', () => {
  const a = setup();
  assert.equal(A.bmi(82, 160), '32.0');
  assert.equal(A.bmi('', 160), '');
  assert.equal(A.bmiLabel(22), 'Normal');
  assert.equal(A.bmiLabel(32), 'Obese II');
  const m = a.saveMember({ name: 'Riya' });
  const pen = byName(a, 'Mounjaro 15mg');
  a.adjustStock(pen.id, 2, 'count');
  a.saveSale({ type: 'injection', patientName: 'Asha', mobile: '9876543210', itemId: pen.id, amount: 17000, refId: m.id, age: '42', gender: 'Female', city: 'Salt Lake' });
  const p = a.state.patients[0];
  assert.deepEqual([p.age, p.gender, p.city], ['42', 'Female', 'Salt Lake']);
  // A later sale without details keeps them.
  a.saveSale({ type: 'injection', patientName: 'Asha', mobile: '9876543210', itemId: pen.id, amount: 17000, refId: m.id, age: '' });
  assert.equal(a.state.patients[0].age, '42');
  const ap = a.saveAppointment({ patientName: 'Asha', mobile: '9876543210', date: '2026-09-15', mode: 'clinic', weight: '82', height: '160', vitals: { weight: '82', height: '160', bp: '130/85', pulse: '' } });
  assert.deepEqual(ap.vitals, { weight: '82', height: '160', bp: '130/85' });
  assert.equal(a.state.patients[0].weight, '82');
  const row = a.sheetsData().Patients[1];
  assert.deepEqual(row.slice(-6), ['42', 'Female', 'Salt Lake', '82', '160', '32.0']);
});

test('protein sales have no new / renewal; injections count earlier injections only', () => {
  const a = setup();
  const m = a.saveMember({ name: 'Riya' });
  const pen = byName(a, 'Mounjaro 15mg'); const pro = byName(a, 'Protein Sachets');
  a.adjustStock(pen.id, 3, 'count'); a.adjustStock(pro.id, 5, 'count');
  const p1 = a.saveSale({ type: 'protein', patientName: 'Asha', mobile: '9876543210', itemId: pro.id, amount: 2500, refId: m.id, date: '2026-09-01', patientType: 'renewal' });
  assert.equal(p1.patientType, '');
  const i1 = a.saveSale({ type: 'injection', patientName: 'Asha', mobile: '9876543210', itemId: pen.id, amount: 17000, refId: m.id, date: '2026-09-02' });
  assert.equal(i1.patientType, 'new', 'earlier protein does not make the first injection a renewal');
  const i2 = a.saveSale({ type: 'injection', patientName: 'Asha', mobile: '9876543210', itemId: pen.id, amount: 17000, refId: m.id, date: '2026-09-10' });
  assert.equal(i2.patientType, 'renewal');
});

test('two devices editing at once are merged: newest record wins, deletions stay, nothing lost', () => {
  const store = A.memoryStorage();
  let now = new Date('2026-09-15T10:00:00');
  const base = A.createAdmin(store, () => now);
  const m = base.saveMember({ name: 'Riya' });
  const pen = byName(base, 'Mounjaro 15mg');
  base.adjustStock(pen.id, 10, 'count');
  const old = base.saveSale({ type: 'injection', patientName: 'Old', mobile: '9000000001', itemId: pen.id, amount: 17000, refId: m.id });
  const shared = JSON.parse(JSON.stringify(base.exportState()));
  // Two phones start from the same sheet copy.
  const phoneA = A.createAdmin(A.memoryStorage(), () => now); phoneA.loadState(JSON.parse(JSON.stringify(shared)));
  const phoneB = A.createAdmin(A.memoryStorage(), () => now); phoneB.loadState(JSON.parse(JSON.stringify(shared)));
  now = new Date('2026-09-15T10:05:00');
  phoneA.saveSale({ type: 'injection', patientName: 'Asha', mobile: '9000000002', itemId: pen.id, amount: 17000, refId: m.id });
  phoneA.saveMember({ ...phoneA.member(m.id), salary: 20000 });
  now = new Date('2026-09-15T10:06:00');
  phoneB.saveAppointment({ patientName: 'Ravi', mobile: '9000000003', date: '2026-09-15', mode: 'clinic' });
  phoneB.saveMember({ ...phoneB.member(m.id), salary: 25000 }); // later edit wins
  phoneB.deleteSale(old.id);
  // Phone A saved first; phone B merges with the sheet (A's copy).
  const merged = A.mergeStates(phoneB.exportState(), phoneA.exportState());
  const c = A.createAdmin(A.memoryStorage(), () => now); c.loadState(merged);
  assert.deepEqual(c.state.sales.map((x) => x.patientName), ['Asha'], 'A\'s new sale kept, B\'s deletion kept');
  assert.equal(c.state.appointments.length, 1, 'B\'s appointment kept');
  assert.equal(c.member(m.id).salary, 25000, 'newest edit wins');
  assert.ok(c.state.patients.some((p) => p.name === 'Asha') && c.state.patients.some((p) => p.name === 'Ravi'));
  assert.equal(c.stockOf(pen.id), 9, 'stock moves merged: 10 in, Asha −1, Old\'s sale deleted');
  // Merging again changes nothing.
  assert.deepEqual(A.mergeStates(merged, merged).sales.length, 1);
});

test('invoice numbers per financial year, kept once given; login activity logged', () => {
  const a = setup('2026-10-02');
  const m = a.saveMember({ name: 'Riya' });
  const pen = byName(a, 'Mounjaro 15mg'); a.adjustStock(pen.id, 5, 'count');
  const s1 = a.saveSale({ type: 'injection', patientName: 'Asha', mobile: '9000000001', itemId: pen.id, amount: 17000, refId: m.id, payMethod: 'UPI' });
  const s2 = a.saveSale({ type: 'injection', patientName: 'Ravi', mobile: '9000000002', itemId: pen.id, amount: 17000, refId: m.id, date: '2026-03-20' });
  assert.equal(s1.payMethod, 'UPI');
  assert.equal(a.invoiceFor('sale', s1.id), 'HV/INV/26-27/0001');
  assert.equal(a.invoiceFor('sale', s1.id), 'HV/INV/26-27/0001', 'same number again');
  assert.equal(a.invoiceFor('sale', s2.id), 'HV/INV/25-26/0001', 'March belongs to the previous financial year');
  const ap = a.saveAppointment({ patientName: 'Asha', mobile: '9000000001', date: '2026-10-02', mode: 'clinic' });
  assert.equal(a.invoiceFor('opd', ap.id), 'HV/OPD/26-27/0001');
  a.updateSettings({ invoicePrefix: 'HDV' });
  const s3 = a.saveSale({ type: 'injection', patientName: 'Nusrat', mobile: '9000000003', itemId: pen.id, amount: 17000, refId: m.id });
  assert.equal(a.invoiceFor('sale', s3.id), 'HDV/INV/26-27/0001');
  a.logEvent('Signed in', 'Super Admin · Android', 'Super Admin');
  a.logEvent('Wrong PIN', 'Sign-in attempt', 'Front Desk');
  const last = a.state.log.slice(-2);
  assert.deepEqual(last.map((x) => [x.action, x.by]), [['Signed in', 'Super Admin'], ['Wrong PIN', 'Front Desk']]);
  assert.ok(a.state.settings.legalNote.includes('does not require a signature'));
});

test('purchase invoice item: description and program months kept on the sale', () => {
  const a = setup('2026-10-02');
  const m = a.saveMember({ name: 'Riya' });
  const pen = byName(a, 'Mounjaro 10mg'); a.adjustStock(pen.id, 2, 'count');
  const s = a.saveSale({ type: 'injection', patientName: 'Asha', mobile: '9000000001', itemId: pen.id, amount: 17000, refId: m.id, programMonths: 3 });
  assert.equal(s.programMonths, 3);
  assert.equal(a.state.settings.invoiceItemName, 'Weight Loss Program');
  a.setInvoiceInfo(s.id, { desc: 'Weight Loss Program', months: '6' });
  assert.equal(a.state.sales[0].programMonths, 6);
  assert.equal(a.state.sales[0].invoiceDesc, 'Weight Loss Program');
  a.saveSale({ ...a.state.sales[0], id: s.id, refId: m.id, programMonths: '' });
  assert.equal(a.state.sales[0].programMonths, 6, 'editing the sale keeps the months');
});

test('WhatsApp messages become leads once, with history; patients and outgoing messages skipped', () => {
  const a = setup('2026-10-03');
  const t = new Date('2026-10-03T10:00:00').getTime();
  const msgs = [
    { id: 'w1', at: t, dir: 'in', phone: '919876543210', name: 'Asha', text: 'Hello! Can I get more info on this?' },
    { id: 'w2', at: t + 60000, dir: 'in', phone: '919876543210', name: 'Asha', text: 'Do you have weekend OPD?' },
    { id: 'w3', at: t + 90000, dir: 'out', phone: '919876543210', text: 'Yes, Sunday 10 AM' },
  ];
  assert.deepEqual(a.importWhatsApp(msgs), { created: 1, updated: 2 });
  const l = a.state.leads[0];
  assert.equal(l.id, 'wa9876543210'); assert.equal(l.mobile, '9876543210'); assert.equal(l.source, 'WhatsApp'); assert.equal(l.name, 'Asha');
  assert.equal(l.history.filter((h) => h.type === 'whatsapp').length, 2);
  assert.deepEqual(a.importWhatsApp(msgs), { created: 0, updated: 0 }, 'same messages again change nothing');
  // An existing patient messaging does not become a lead.
  const m = a.saveMember({ name: 'Riya' }); const pro = byName(a, 'Protein Sachets'); a.adjustStock(pro.id, 2, 'count');
  a.saveSale({ type: 'protein', patientName: 'Ravi', mobile: '9876500000', itemId: pro.id, amount: 2500, refId: m.id });
  assert.deepEqual(a.importWhatsApp([{ id: 'w9', at: t, dir: 'in', phone: '919876500000', text: 'Hello! Can I get more info on this?' }]), { created: 0, updated: 0 });
  // Only the ad message makes a lead; other first messages from new numbers do not.
  assert.deepEqual(a.importWhatsApp([{ id: 'w11', at: t, dir: 'in', phone: '919830000002', text: 'Hi, are you open today?' }]), { created: 0, updated: 0 });
  assert.equal(a.importWhatsApp([{ id: 'w12', at: t, dir: 'in', phone: '919830000003', text: 'hello!  can i get more INFO on this?' }]).created, 1, 'case and spaces ignored');
  a.updateSettings({ waLeadPhrases: [] });
  assert.equal(a.importWhatsApp([{ id: 'w13', at: t, dir: 'in', phone: '919830000004', text: 'Any message' }]).created, 1, 'empty list = every new number');
  a.updateSettings({ waAutoLead: false });
  assert.deepEqual(a.importWhatsApp([{ id: 'w10', at: t, dir: 'in', phone: '919830000001', text: 'Hi' }]), { created: 0, updated: 0 });
});

test('import leads from a Heyo / MyOperator export: duplicates, patients and phrase filter', () => {
  const a = setup('2026-10-03');
  a.saveLead({ name: 'Old Lead', mobile: '9000000001' });
  const m = a.saveMember({ name: 'Riya' }); const pro = byName(a, 'Protein Sachets'); a.adjustStock(pro.id, 1, 'count');
  a.saveSale({ type: 'protein', patientName: 'Patient', mobile: '9000000002', itemId: pro.id, amount: 2500, refId: m.id });
  const rows = [
    { phone: '+91 90000 00001', name: 'Old Lead', message: 'Hello! Can I get more info on this?' },
    { phone: '919000000002', name: 'Patient', message: 'Hello! Can I get more info on this?' },
    { phone: '9000000003', name: 'Asha', message: 'Hello! Can I get more info on this?', date: '2026-10-01' },
    { phone: '9000000003', name: 'Asha again', message: 'hi' },
    { phone: '9000000004', name: 'Ravi', message: 'Is the clinic open?' },
    { phone: '123', name: 'Bad number', message: 'Hello! Can I get more info on this?' },
  ];
  assert.deepEqual(a.importLeads(rows, { onlyPhrases: true, fileName: 'heyo.xlsx' }), { added: 1, skipped: 3, dupes: 2 });
  const l = a.state.leads.find((x) => x.name === 'Asha');
  assert.equal(l.id, 'wa9000000003'); assert.equal(l.date, '2026-10-01'); assert.equal(l.source, 'WhatsApp');
  assert.deepEqual(a.importLeads(rows, { fileName: 'heyo.xlsx' }), { added: 1, skipped: 1, dupes: 4 }, 'without the filter Ravi is added too');
});

test('MyOperator panel data: chats parsed from any JSON shape, agents become "Assigned to"', () => {
  const t = Date.UTC(2026, 9, 3, 5, 0);
  // A chat list (contact nested, agent as object) and an opened chat (messages under the conversation).
  const list = { data: { conversations: [
    { id: 'c1', contact: { name: 'Asha', phone_number: '+91 98765 43210' }, lastMessage: { body: 'Hello! Can I get more info on this?' }, updatedAt: new Date(t).toISOString(), assignedTo: { id: 7, fullName: 'Priya Das', phone: '9111111111' } },
    { id: 'c2', customer_number: '919830000002', name: 'Ravi', last_message: 'price?', last_message_time: Math.floor(t / 1000), agent_name: 'Murshida' },
  ] } };
  const chat = { chat: { wa_id: '919876543210', messages: [
    { id: 'm1', text: 'Hello! Can I get more info on this?', timestamp: Math.floor(t / 1000), direction: 'inbound' },
    { id: 'm2', text: { body: 'Sure, call us' }, timestamp: Math.floor(t / 1000) + 60, from: '918920831975', to: '919876543210' },
  ] } };
  const p1 = A.parseChatCapture(list, ['+918920831975']);
  assert.deepEqual(p1.convs.map((c) => [c.phone, c.name, c.assignee]), [['9876543210', 'Asha', 'Priya Das'], ['9830000002', 'Ravi', 'Murshida']]);
  assert.equal(p1.convs[0].at, t); assert.equal(p1.convs[1].at, t);
  const p2 = A.parseChatCapture(chat, ['8920831975']);
  assert.deepEqual(p2.msgs.map((m) => [m.phone, m.dir, m.text]), [['9876543210', 'in', 'Hello! Can I get more info on this?'], ['9876543210', 'out', 'Sure, call us']]);
  assert.ok(!p1.convs.some((c) => c.phone === '9111111111'), "the agent's own number is not a chat");

  const a = setup('2026-10-03');
  const priya = a.saveAccount({ name: 'Priya Das', role: 'desk' });
  const mur = a.saveAccount({ name: 'Murshida Khatun', role: 'desk' });
  const r = a.heyoSync({ msgs: [...p1.msgs, ...p2.msgs], convs: [...p1.convs, ...p2.convs] });
  const asha = a.state.leads.find((l) => l.mobile === '9876543210');
  assert.equal(asha.assignedTo, priya.id, 'same name');
  assert.ok(!a.state.leads.some((l) => l.mobile === '9830000002'), 'no ad message, no lead');
  assert.equal(r.assigned, 1);
  // Ravi's lead made by hand: first name "Murshida" matches one login.
  a.saveLead({ name: 'Ravi', mobile: '9830000002' });
  assert.equal(a.heyoSync({ convs: p1.convs }).assigned, 1);
  assert.equal(a.state.leads.find((l) => l.mobile === '9830000002').assignedTo, mur.id);
  // A change made in the app stays until the panel's agent changes.
  a.saveLead({ ...asha, assignedTo: mur.id });
  a.heyoSync({ convs: p1.convs });
  assert.equal(a.state.leads.find((l) => l.mobile === '9876543210').assignedTo, mur.id);
  // Unknown agents are reported and can be mapped in Settings.
  const res = a.heyoSync({ convs: [{ phone: '9876543210', assignee: 'Neha (Heyo)' }] });
  assert.deepEqual(res.unknown, ['Neha (Heyo)']);
  assert.ok(a.state.settings.heyoSeen.includes('Neha (Heyo)'));
  a.updateSettings({ heyoAgents: { 'neha (heyo)': priya.id } });
  assert.equal(a.heyoSync({ convs: [{ phone: '9876543210', assignee: 'Neha (Heyo)' }] }).assigned, 1);
  assert.equal(a.state.leads.find((l) => l.mobile === '9876543210').assignedTo, priya.id);
});

test('MyOperator socket.io / nested payloads parse into chats', () => {
  // A live-message array payload (socket.io event: ["new_message", {...}]) and a nested wrapper.
  const t = Date.UTC(2026, 9, 3, 6, 0);
  const sock = ['message_new', { conversation: { contact: { name: 'Vikram', phone: '+91 90000 12345' }, assigned_agent: { first_name: 'Priya', last_name: 'Das' } }, message: { body: 'Hello! Can I get more info on this?', created_at: new Date(t).toISOString(), direction: 'incoming' } }];
  const p = A.parseChatCapture(sock, ['910000000000']);
  assert.deepEqual(p.convs.map((c) => [c.phone, c.name, c.assignee]), [['9000012345', 'Vikram', 'Priya Das']]);
  assert.deepEqual(p.msgs.map((m) => [m.phone, m.dir, m.text]), [['9000012345', 'in', 'Hello! Can I get more info on this?']]);
});

test('MyOperator on-screen scrape: only ad-message chats become leads, rest with empty phrase', () => {
  const a = setup('2026-10-03');
  // Shape produced by the screen scraper: conversations with phone, name and the row text.
  const convs = [
    { phone: '9830011111', name: 'Asha Sharma', text: 'Asha Sharma Hello! Can I get more info on this?' },
    { phone: '9830022222', name: 'Ravi Kumar', text: 'Ravi Kumar price?' },
  ];
  const data = A.parseChatCapture({ conversations: convs }, ['910000000000']);
  assert.equal(data.convs.length, 2);
  // Default phrase = the ad message: only Asha qualifies.
  let r = a.heyoSync(data);
  assert.equal(r.created, 1);
  assert.ok(a.state.leads.some((l) => l.mobile === '9830011111'));
  assert.ok(!a.state.leads.some((l) => l.mobile === '9830022222'));
  // Clearing the phrase makes every chat a lead; no duplicate for Asha.
  a.updateSettings({ waLeadPhrases: [] });
  r = a.heyoSync(A.parseChatCapture({ conversations: convs }, []));
  assert.equal(r.created, 1);
  assert.equal(a.state.leads.filter((l) => l.mobile === '9830011111').length, 1);
});

test('WhatsApp lead names: junk (HTML, buttons, numbers) fall back to the number; real names kept', () => {
  const a = setup('2026-10-03');
  a.updateSettings({ waLeadPhrases: [] }); // every chat becomes a lead
  // Names exactly like the ones seen on the MyOperator screen.
  const convs = [
    { phone: '9316047570', name: 'WhatsApp 9316047570', text: 'hi' },
    { phone: '9830011111', name: '<img height="1" width="1" style="display', text: 'hi' },
    { phone: '9830022222', name: 'Talk to us on', text: 'hi' },
    { phone: '9830033333', name: 'pawan', text: 'hi' },
    { phone: '9830044444', name: '', text: 'hi' },
  ];
  a.heyoSync(A.parseChatCapture({ conversations: convs }, []));
  const by = (m) => a.state.leads.find((l) => l.mobile === m);
  assert.equal(by('9316047570').name, '9316047570', 'the "WhatsApp <num>" label becomes the number');
  assert.equal(by('9830011111').name, '9830011111', 'HTML is never a name');
  assert.equal(by('9830022222').name, '9830022222', 'a button is never a name');
  assert.equal(by('9830033333').name, 'pawan', 'a real name is kept');
  assert.equal(by('9830044444').name, '9830044444', 'no name → the number');
  // Later learning a real name upgrades a number-named lead.
  a.heyoSync(A.parseChatCapture({ conversations: [{ phone: '9830022222', name: 'Sunita', text: 'hi' }] }, []));
  assert.equal(by('9830022222').name, 'Sunita');
});

test('fixWhatsAppNames tidies leads saved by older builds', () => {
  const a = setup('2026-10-03');
  a.state.leads.push({ id: 'wa9830011111', name: '<img height="1" width="1" style="display', mobile: '9830011111', source: 'WhatsApp', status: 'New', history: [] });
  a.state.leads.push({ id: 'waX', name: 'Talk to us on', mobile: '123', source: 'WhatsApp', status: 'New', history: [] });
  a.state.leads.push({ id: 'l1', name: 'Real Patient Lead', mobile: '9811112222', source: 'Walk-in', status: 'New', history: [] });
  const r = a.fixWhatsAppNames();
  assert.equal(r.removed, 1, 'the one without a real number is removed');
  assert.equal(a.state.leads.find((l) => l.mobile === '9830011111').name, '9830011111');
  assert.ok(a.state.leads.some((l) => l.name === 'Real Patient Lead'), 'non-WhatsApp leads untouched');
});

test('deleteLeads removes several leads at once', () => {
  const a = setup('2026-10-03');
  const l1 = a.saveLead({ name: 'A', mobile: '9000000001' });
  const l2 = a.saveLead({ name: 'B', mobile: '9000000002' });
  const l3 = a.saveLead({ name: 'C', mobile: '9000000003' });
  assert.equal(a.state.leads.length, 3);
  const removed = a.deleteLeads([l1.id, l3.id]);
  assert.equal(removed, 2);
  assert.deepEqual(a.state.leads.map((l) => l.name), ['B']);
  assert.equal(a.deleteLeads(['nope']), 0, 'unknown ids remove nothing');
});

test('partial sale payment: due tracked, pendingSales lists it, settleSale clears it', () => {
  const a = setup('2026-10-06');
  const m = a.saveMember({ name: 'Riya' });
  const pen = byName(a, 'Mounjaro 15mg'); a.adjustStock(pen.id, 5, 'count');
  // Pay 10000 of a 17000 sale → 7000 due.
  const s = a.saveSale({ type: 'injection', patientName: 'Asha', mobile: '9876543210', itemId: pen.id, amount: 17000, amountPaid: 10000, refId: m.id });
  assert.equal(s.amountPaid, 10000); assert.equal(s.due, 7000);
  let pend = a.pendingSales();
  assert.equal(pend.total, 7000); assert.equal(pend.list.length, 1);
  // Blank amountPaid = fully paid.
  const pro = byName(a, 'Protein Sachets'); a.adjustStock(pro.id, 10, 'count');
  const s2 = a.saveSale({ type: 'protein', patientName: 'Ravi', mobile: '9876500000', itemId: pro.id, amount: 2500, refId: m.id });
  assert.equal(s2.due, 0, 'blank paid = full');
  // Collect 5000 towards the 7000 due → 2000 left.
  a.settleSale(s.id, 5000, 'UPI');
  assert.equal(a.state.sales.find((x) => x.id === s.id).due, 2000);
  assert.equal(a.state.sales.find((x) => x.id === s.id).payMethod, 'UPI');
  // Blank add clears the rest.
  a.settleSale(s.id, 0);
  assert.equal(a.state.sales.find((x) => x.id === s.id).due, 0);
  assert.equal(a.pendingSales().total, 0);
});
