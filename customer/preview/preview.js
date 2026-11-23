(() => {
  const examples = {
    definitions: {
      title: 'Definitions',
      samples: {
        10: ['Physical quantity', 'A physical quantity is a property that can be measured and expressed by a number and a unit.'],
        11: ['Force', 'A force is an interaction that can change an object’s motion or shape.'],
        12: ['Gravitational field strength', 'Gravitational field strength at a point is the gravitational force per unit mass placed at that point.']
      }
    },
    calculations: {
      title: 'Calculations',
      samples: {
        10: ['Measurement example', 'A length of 2.5 m is written in centimetres as 2.5 × 100 = 250 cm.'],
        11: ['Motion example', 'A 2 kg object accelerates at 3 m s⁻². Using F = ma, the resultant force is 2 × 3 = 6 N.'],
        12: ['Energy example', 'A 2 kg object moves at 3 m s⁻¹. Its kinetic energy is ½mv² = ½ × 2 × 3² = 9 J.']
      }
    },
    objectives: {
      title: 'Objectives',
      samples: {
        10: ['Sample question', 'Which SI unit is used to measure mass?\nA. metre     B. kilogram     C. second'],
        11: ['Sample question', 'Which quantity is measured in newtons?\nA. force     B. energy     C. power'],
        12: ['Sample question', 'Which expression gives kinetic energy?\nA. mv     B. ½mv²     C. mgh']
      }
    }
  };
  const params = new URLSearchParams(location.search);
  const type = examples[params.get('type')] ? params.get('type') : 'definitions';
  const grade = ['10', '11', '12'].includes(params.get('grade')) ? params.get('grade') : '10';
  const [title, body] = examples[type].samples[grade];
  document.title = `${examples[type].title} · Grade ${grade} Preview`;
  document.getElementById('preview-title').textContent = examples[type].title;
  document.getElementById('preview-grade').textContent = `Grade ${grade}`;
  document.getElementById('sample-title').textContent = title;
  document.getElementById('sample-body').textContent = body;
  const answer = document.getElementById('sample-answer');
  if (type === 'objectives') {
    answer.hidden = false;
    document.getElementById('sample-answer-text').textContent = ({10:'B. kilogram',11:'A. force',12:'B. ½mv²'})[grade];
  } else answer.hidden = true;
})();
