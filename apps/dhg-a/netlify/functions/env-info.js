exports.handler = async function(event, context) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      environment: process.env.CONTEXT,
      appName: process.env.VITE_APP_NAME,
      features: process.env.VITE_FEATURE_FLAGS
    })
  };
}
