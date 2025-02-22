# React Component Analysis System Prompt

This specialized prompt is designed for analyzing React components. It should be used in conjunction with the main code analysis prompt when analyzing React-specific code. The analysis should be returned as a JSON object with the following structure:

```json
{
  "component_overview": {
    "name": "string - Component name",
    "type": "string - Class/Function/HOC/etc",
    "purpose": "string - Primary component purpose",
    "complexity_level": "string - low/medium/high",
    "reusability": "string - Assessment of reusability",
    "key_dependencies": ["array of main dependencies"]
  },

  "component_architecture": {
    "props": [{
      "name": "string - Prop name",
      "type": "string - Prop type",
      "required": "boolean",
      "default_value": "any - Default value if any",
      "validation": "string - Validation requirements",
      "description": "string - Prop purpose",
      "usage_pattern": "string - How the prop is used"
    }],
    "internal_state": [{
      "name": "string - State name",
      "type": "string - State type",
      "initial_value": "any - Initial state value",
      "update_triggers": ["array of update triggers"],
      "dependencies": ["array of dependencies"],
      "persistence_requirements": "string - If/how state should persist"
    }],
    "refs": [{
      "name": "string - Ref name",
      "target": "string - What this refs",
      "purpose": "string - Why this ref is needed",
      "initialization": "string - How ref is initialized"
    }]
  },

  "component_lifecycle": {
    "initialization": {
      "props_processing": ["array of prop processing steps"],
      "state_initialization": ["array of state initialization steps"],
      "side_effects": ["array of initialization effects"]
    },
    "mounting": {
      "sequence": ["array of mounting steps"],
      "effects": [{
        "purpose": "string - Effect purpose",
        "dependencies": ["array of dependencies"],
        "cleanup": "string - Cleanup requirements"
      }],
      "error_handling": ["array of error handlers"]
    },
    "updates": [{
      "trigger": "string - What causes this update",
      "affected_state": ["array of affected state"],
      "side_effects": ["array of triggered effects"],
      "optimization": {
        "memoization": "boolean",
        "strategy": "string - How it's optimized"
      }
    }],
    "unmounting": {
      "cleanup_operations": ["array of cleanup tasks"],
      "state_persistence": ["array of state to persist"]
    }
  },

  "render_logic": {
    "conditions": [{
      "description": "string - What this condition does",
      "dependencies": ["array of dependencies"],
      "branches": ["array of possible outcomes"]
    }],
    "dynamic_content": [{
      "location": "string - Where in render",
      "data_source": "string - Where data comes from",
      "update_trigger": "string - What triggers updates"
    }],
    "optimizations": [{
      "type": "string - Optimization type",
      "target": "string - What's optimized",
      "strategy": "string - How it's optimized"
    }]
  },

  "state_management": {
    "local_state": [{
      "name": "string - State name",
      "type": "string - State type",
      "update_pattern": "string - How it's updated",
      "dependencies": ["array of dependencies"],
      "initialization": "string - How it's initialized"
    }],
    "derived_state": [{
      "name": "string - Derived state name",
      "computation": "string - How it's computed",
      "dependencies": ["array of dependencies"],
      "caching_strategy": "string - How it's cache