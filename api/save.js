const GH_FILE = 'data.json';

function corsHeaders(origin){
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

function json(res, code, body, origin){
  res.statusCode = code;
  const headers = corsHeaders(origin);
  Object.keys(headers).forEach(k => res.setHeader(k, headers[k]));
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res){
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '';
  const origin = req.headers.origin || allowedOrigin || '*';

  if(req.method === 'OPTIONS') return json(res, 200, {ok:true}, origin);
  if(req.method !== 'POST') return json(res, 405, {error:'Method Not Allowed'}, origin);

  if(allowedOrigin && req.headers.origin && req.headers.origin !== allowedOrigin){
    return json(res, 403, {error:'Origin Not Allowed'}, origin);
  }

  try{
    const ghUser = process.env.GH_USER;
    const ghRepo = process.env.GH_REPO;
    const ghToken = process.env.GH_TOKEN;
    if(!ghUser || !ghRepo || !ghToken){
      return json(res, 500, {error:'Server env is not configured'}, origin);
    }

    const payload = req.body;
    if(!payload || !Array.isArray(payload.tasks)){
      return json(res, 400, {error:'Invalid payload'}, origin);
    }

    const ghApi = `https://api.github.com/repos/${ghUser}/${ghRepo}/contents/${GH_FILE}`;
    const getRes = await fetch(ghApi, {
      headers: {
        Authorization: `token ${ghToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'roadmap-save-api'
      }
    });
    const getJson = await getRes.json();
    if(!getRes.ok || !getJson.sha){
      return json(res, 500, {error:getJson.message || 'Failed to load file SHA'}, origin);
    }

    const content = Buffer.from(JSON.stringify(payload, null, 2), 'utf8').toString('base64');
    const putRes = await fetch(ghApi, {
      method: 'PUT',
      headers: {
        Authorization: `token ${ghToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'roadmap-save-api'
      },
      body: JSON.stringify({
        message: `data 업데이트 ${new Date().toLocaleString('ko-KR')}`,
        content,
        sha: getJson.sha
      })
    });
    const putJson = await putRes.json();
    if(!putRes.ok){
      return json(res, 500, {error:putJson.message || 'Failed to save data'}, origin);
    }

    return json(res, 200, {ok:true}, origin);
  }catch(err){
    return json(res, 500, {error:err.message || 'Unknown error'}, origin);
  }
};
