module.exports = {
  // ... other config
  rules: {
    'no-toast-info': {
      create(context) {
        return {
          MemberExpression(node) {
            if (
              node.object.name === 'toast' &&
              node.property.name === 'info'
            ) {
              context.report({
                node,
                message: 'Use toast.success for positive messages or toast.error for warnings instead of toast.info',
                fix(fixer) {
                  return fixer.replaceText(node.property, 'success');
                }
              });
            }
          }
        };
      }
    }
  }
}; 