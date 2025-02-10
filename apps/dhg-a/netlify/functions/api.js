exports.handler = async function(event, context) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'API is working!',
      environment: process.env.CONTEXT,
      time: new Date().toISOString()
    })
  };
}
