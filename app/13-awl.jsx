    // --- AKADEMİK KELİME LİSTESİ (AWL, Coxhead 2000): 570 kelime ailesi, 10 alt liste (1 = en sık) ---
    const AWL_SUBLISTS = [
      'analyse approach area assess assume authority available benefit concept consist constitute context contract create data define derive distribute economy environment establish estimate evident export factor finance formula function identify income indicate individual interpret involve issue labour legal legislate major method occur percent period policy principle proceed process require research respond role section sector significant similar source specific structure theory vary',
      'achieve acquire administrate affect appropriate aspect assist category chapter commission community complex compute conclude conduct consequent construct consume credit culture design distinct element equate evaluate feature final focus impact injure institute invest item journal maintain normal obtain participate perceive positive potential previous primary purchase range region regulate relevant reside resource restrict secure seek select site strategy survey text tradition transfer',
      'alternative circumstance comment compensate component consent considerable constant constrain contribute convene coordinate core corporate correspond criteria deduce demonstrate document dominate emphasis ensure exclude framework fund illustrate immigrate imply initial instance interact justify layer link locate maximise minor negate outcome partner philosophy physical proportion publish react register rely remove scheme sequence sex shift specify sufficient task technical technique technology valid volume',
      'access adequate annual apparent approximate attitude attribute civil code commit communicate concentrate confer contrast cycle debate despite dimension domestic emerge error ethnic goal grant hence hypothesis implement implicate impose integrate internal investigate job label mechanism obvious occupy option output overall parallel parameter phase predict principal prior professional project promote regime resolve retain series statistic status stress subsequent sum summary undertake',
      'academy adjust alter amend aware capacity challenge clause compound conflict consult contact decline discrete draft enable energy enforce entity equivalent evolve expand expose external facilitate fundamental generate generation image liberal licence logic margin medical mental modify monitor network notion objective orient perspective precise prime psychology pursue ratio reject revenue stable style substitute sustain symbol target transit trend version welfare whereas',
      'abstract accurate acknowledge aggregate allocate assign attach author bond brief capable cite cooperate discriminate display diverse domain edit enhance estate exceed expert explicit federal fee flexible furthermore gender ignorant incentive incidence incorporate index inhibit initiate input instruct intelligence interval lecture migrate minimum ministry motive neutral nevertheless overseas precede presume rational recover reveal scope subsidy tape trace transform transport underlie utilise',
      'adapt adult advocate aid channel chemical classic comprehensive comprise confirm contrary convert couple decade definite deny differentiate dispose dynamic eliminate empirical equip extract file finite foundation globe grade guarantee hierarchy identical ideology infer innovate insert intervene isolate media mode paradigm phenomenon priority prohibit publication quote release reverse simulate sole somewhat submit successor survive thesis topic transmit ultimate unique visible voluntary',
      'abandon accompany accumulate ambiguous append appreciate arbitrary automate bias chart clarify commodity complement conform contemporary contradict crucial currency denote detect deviate displace drama eventual exhibit exploit fluctuate guideline highlight implicit induce inevitable infrastructure inspect intense manipulate minimise nuclear offset paragraph plus practitioner predominant prospect radical random reinforce restore revise schedule tension terminate theme thereby uniform vehicle via virtual visual widespread',
      'accommodate analogy anticipate assure attain behalf bulk cease coherent coincide commence compatible concurrent confine controversy converse device devote diminish distort duration erode ethic format found inherent insight integral intermediate manual mature mediate medium military minimal mutual norm overlap passive portion preliminary protocol qualitative refine relax restrain revolution rigid route scenario sphere subordinate supplement suspend team temporary trigger unify violate vision',
      'adjacent albeit assemble collapse colleague compile conceive convince depress encounter enormous forthcoming incline integrity intrinsic invoke levy likewise nonetheless notwithstanding odd ongoing panel persist pose reluctance so-called straightforward undergo whereby',
    ].map(s => s.split(' '));
    // Kelime ailesi eşleşmesi: kısa kelimeler birebir, uzunlarda ortak kök (analyse ↔ analysis, analytical)
    const AWL_INDEX = (() => {
      const exact = new Map(), stems = [];
      const amToBr = (w) => w.replace(/ize$/, 'ise').replace(/yze$/, 'yse').replace(/^labor/, 'labour').replace(/^license/, 'licence');
      AWL_SUBLISTS.forEach((words, i) => words.forEach(h => {
        exact.set(h, i + 1);
        if (h.length > 5) stems.push([h.slice(0, Math.max(5, h.length - 2)), i + 1]);
      }));
      return { exact, stems, amToBr };
    })();
    const AWL_FALSE = new Set(['found', 'founded', 'textile', 'texture', 'sexy', 'teammate']);
    const awlSublist = (word) => {
      if (!word) return 0;
      let w = String(word).toLowerCase().trim();
      if (AWL_FALSE.has(w)) return 0;
      w = AWL_INDEX.amToBr(w);
      if (AWL_INDEX.exact.has(w)) return AWL_INDEX.exact.get(w);
      for (const base of [w.replace(/(s|es|ed|ing|ly)$/, ''), w.replace(/ies$/, 'y'), w.replace(/ied$/, 'y')]) if (AWL_INDEX.exact.has(base)) return AWL_INDEX.exact.get(base);
      for (const [stem, n] of AWL_INDEX.stems) if (w.startsWith(stem)) return n;
      return 0;
    };
    const AwlBadge = ({ word }) => { const n = awlSublist(word); return n ? <span title={'Akademik Kelime Listesi, alt liste ' + n + ' (1 = en sık)'} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-950 text-purple-300">AWL {n}</span> : null; };

