import React, { useState } from 'react';
import { CheckCircle2, ChefHat, Sparkles } from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { soundEngine } from '../../utils/soundEngine';

const FOOD_ITEMS = [
  { id: 'strawberry', ar: 'فراولة', en: 'Strawberry', emoji: '🍓', cat: 'fruit' },
  { id: 'banana', ar: 'موزة', en: 'Banana', emoji: '🍌', cat: 'fruit' },
  { id: 'carrot', ar: 'جزرة', en: 'Carrot', emoji: '🥕', cat: 'veggie' },
  { id: 'broccoli', ar: 'بروكلي', en: 'Broccoli', emoji: '🥦', cat: 'veggie' },
  { id: 'milk', ar: 'حليب', en: 'Milk', emoji: '🥛', cat: 'dairy' },
  { id: 'bread', ar: 'خبز قمح', en: 'Whole Bread', emoji: '🍞', cat: 'grain' },
];

const HEALTHY_SMOOTHIE_STEPS = [
  { id: 'wash', ar: '١. نغسل الفراولة والموز جيداً 💧', en: '1. Wash the berries & banana 💧' },
  { id: 'peel', ar: '٢. نقشر الموز ونضع ٣ فراولات 🍓🍌', en: '2. Peel banana & add 3 strawberries 🍓🍌' },
  { id: 'pour', ar: '٣. نسكب كوب الحليب الطازج 🥛', en: '3. Pour a cup of fresh milk 🥛' },
  { id: 'blend', ar: '٤. نخلط العصير الصحي معاً! 🥤', en: '4. Blend our healthy smoothie! 🥤' },
];

export const LittleChefPanel: React.FC = () => {
  const { activeChild, language, saveEntertainmentCreation } = useNonoLand();
  const [sortedMap, setSortedMap] = useState<Record<string, string>>({});
  const [selectedFoodId, setSelectedFoodId] = useState<string>('strawberry');
  const [strawberriesAdded, setStrawberriesAdded] = useState(0);
  const [bananasAdded, setBananasAdded] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [recipeMessage, setRecipeMessage] = useState('');

  if (!activeChild) return null;

  const assignBucket = (bucket: string) => {
    soundEngine.playPop();
    setSortedMap((prev) => ({ ...prev, [selectedFoodId]: bucket }));
  };

  const sortCorrectCount = FOOD_ITEMS.filter((f) => sortedMap[f.id] === f.cat).length;

  const completeSmoothieRecipe = async () => {
    if (strawberriesAdded !== 3 || bananasAdded !== 2 || completedSteps.length < 4) {
      soundEngine.playEncourage();
      setRecipeMessage(
        language === 'ar'
          ? 'تأكد من وضع ٣ فراولات و٢ موزة وإكمال جميع الخطوات الأربع!'
          : 'Make sure you add 3 strawberries, 2 bananas, and check all 4 steps!',
      );
      return;
    }
    const res = await saveEntertainmentCreation({
      kind: 'chef',
      payload: { recipeId: 'healthy-berry-smoothie' },
    });
    setRecipeMessage(
      language === 'ar'
        ? `أبدعت يا شيف الصغير! العصير الصحي جاهز (+${res.starsAdded} نجوم) 🥤✨`
        : `Awesome Little Chef! Healthy smoothie complete (+${res.starsAdded} stars) 🥤✨`,
    );
  };

  return (
    <div className="space-y-5">
      <div className="nono-card p-5 bg-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
              <ChefHat className="w-6 h-6 text-[#FF9360]" />
              <span>{language === 'ar' ? 'مطبخ الشيف الصغير الصحي' : 'Little Chef Healthy Kitchen'}</span>
            </h2>
            <p className="text-xs font-bold text-[#27345C]/70">
              {language === 'ar' ? 'صنّف الأطعمة، عدّ المكونات، وركّب وصفة صحية خطوة بخطوة!' : 'Sort ingredients, count portions, and follow a healthy recipe step by step!'}
            </p>
          </div>
          <span className="px-3 py-1 rounded-xl bg-[#ECFDF5] text-[#15803D] text-xs font-extrabold">
            {language === 'ar'
              ? `وصفات مكتملة: ${activeChild.completedRecipes?.length || 0}`
              : `Recipes Completed: ${activeChild.completedRecipes?.length || 0}`}
          </span>
        </div>

        {/* 1. Food Identification & Sorting */}
        <div className="p-4 rounded-2xl bg-[#FFF8E9]/70 border border-[#27345C]/10 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#27345C]">
              {language === 'ar' ? '١. صنّف الأطعمة في السلة المناسبة:' : '1. Sort Foods into Healthy Groups:'}
            </h3>
            <span className="text-xs font-extrabold text-[#8054D9]">
              {sortCorrectCount} / {FOOD_ITEMS.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {FOOD_ITEMS.map((item) => {
              const isSelected = selectedFoodId === item.id;
              const isCorrect = sortedMap[item.id] === item.cat;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    soundEngine.speak(item[language], language);
                    setSelectedFoodId(item.id);
                  }}
                  className={`min-h-[46px] px-3.5 rounded-xl border-2 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${
                    isCorrect
                      ? 'bg-[#DCFCE7] border-[#22C55E] text-[#14532D]'
                      : isSelected
                        ? 'bg-[#8054D9] text-white border-[#8054D9]'
                        : 'bg-white border-[#27345C]/15 text-[#27345C]'
                  }`}
                >
                  <span className="text-lg">{item.emoji}</span>
                  <span>{item[language]}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'fruit', ar: 'فواكه 🍓', en: 'Fruits 🍓' },
              { id: 'veggie', ar: 'خضروات 🥦', en: 'Veggies 🥦' },
              { id: 'dairy', ar: 'ألبان 🥛', en: 'Dairy 🥛' },
              { id: 'grain', ar: 'حبوب 🍞', en: 'Grains 🍞' },
            ].map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => assignBucket(b.id)}
                className="min-h-[44px] rounded-xl bg-white hover:bg-[#E5F6FF] border border-[#27345C]/15 text-xs font-extrabold text-[#27345C] cursor-pointer"
              >
                {b[language]}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Ingredient Counting + Step-by-Step Healthy Smoothie */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#27345C]/10 space-y-3">
            <h3 className="text-sm font-extrabold text-[#27345C]">
              {language === 'ar' ? '٢. عدّ المكونات بدقة (٣ 🍓 + ٢ 🍌):' : '2. Count Ingredients (3 🍓 + 2 🍌):'}
            </h3>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white">
              <span className="text-sm font-extrabold">🍓 {strawberriesAdded} / 3</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStrawberriesAdded((v) => Math.max(0, v - 1))}
                  className="w-9 h-9 rounded-lg bg-slate-100 font-extrabold cursor-pointer"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    setStrawberriesAdded((v) => Math.min(5, v + 1));
                  }}
                  className="w-9 h-9 rounded-lg bg-[#FF78B7] text-white font-extrabold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white">
              <span className="text-sm font-extrabold">🍌 {bananasAdded} / 2</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBananasAdded((v) => Math.max(0, v - 1))}
                  className="w-9 h-9 rounded-lg bg-slate-100 font-extrabold cursor-pointer"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    setBananasAdded((v) => Math.min(5, v + 1));
                  }}
                  className="w-9 h-9 rounded-lg bg-[#FFD84D] text-[#27345C] font-extrabold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#27345C]/10 space-y-2.5">
            <h3 className="text-sm font-extrabold text-[#27345C]">
              {language === 'ar' ? '٣. خطوات تحضير الوصفة الصحية:' : '3. Healthy Recipe Steps:'}
            </h3>
            {HEALTHY_SMOOTHIE_STEPS.map((st) => {
              const done = completedSteps.includes(st.id);
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    setCompletedSteps((prev) =>
                      prev.includes(st.id) ? prev.filter((x) => x !== st.id) : [...prev, st.id],
                    );
                  }}
                  className={`w-full p-2.5 rounded-xl text-start text-xs font-extrabold flex items-center justify-between cursor-pointer border ${
                    done ? 'bg-[#DCFCE7] border-[#22C55E] text-[#14532D]' : 'bg-white border-[#27345C]/10 text-[#27345C]'
                  }`}
                >
                  <span>{st[language]}</span>
                  {done && <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void completeSmoothieRecipe()}
            className="min-h-[46px] px-6 rounded-2xl bg-[#55D98B] text-[#27345C] font-extrabold text-sm flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{language === 'ar' ? 'تقديم الوصفة الصحية! 🥤' : 'Serve Healthy Smoothie! 🥤'}</span>
          </button>
          {recipeMessage && <p className="text-xs sm:text-sm font-extrabold text-[#8054D9]">{recipeMessage}</p>}
        </div>
      </div>
    </div>
  );
};
