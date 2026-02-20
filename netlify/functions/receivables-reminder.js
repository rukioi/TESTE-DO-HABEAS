exports.handler = async function () {
  try {
    const url = `${process.env.APP_URL}/api/receivables/notifications/reminder/run`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'x-cron-token': process.env.CRON_SECRET || '' }
    });
    const text = await res.text();
    return { statusCode: res.status, body: text };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'fail' }) };
  }
};

