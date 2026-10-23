import { enrichmentSeedRecords } from './enrichment-data';
import { featureSeedRecords, plusDays, schoolToday } from './platform-data';
export type Role = 'student' | 'teacher' | 'parent' | 'admin';
export type SchoolRecord = {
    id: string;
    kind: string;
    [key: string]: any;
};
export const roles: Record<Role, {
    label: string;
    name: string;
    initials: string;
    subtitle: string;
}> = {
    student: { label: 'Ученик', name: 'Алекс Петров', initials: 'АП', subtitle: '6. А клас' },
    teacher: { label: 'Учител', name: 'Мария Николова', initials: 'МН', subtitle: 'Математика · 6. А' },
    parent: { label: 'Родител', name: 'Елена Петрова', initials: 'ЕП', subtitle: 'Родител на Алекс' },
    admin: { label: 'Администратор', name: 'Иван Димитров', initials: 'ИД', subtitle: 'Училищна администрация' },
};
export const students = ['Алекс Петров', 'Борис Георгиев', 'Виктория Иванова', 'Габриела Попова', 'Даниел Стоянов', 'Елена Тодорова', 'Мартин Колев', 'Никол Димова'];
export const subjects = ['Математика', 'Български език', 'Човекът и природата', 'Английски език', 'История и цивилизации', 'География и икономика'];
export const subjectColors: Record<string, string> = { 'Математика': 'violet', 'Български език': 'orange', 'Човекът и природата': 'green', 'Английски език': 'blue', 'История и цивилизации': 'rose', 'География и икономика': 'teal', 'Физическо възпитание': 'teal', 'Компютърно моделиране': 'blue' };
export const timetable = [
    ['Математика', 'Български език', 'Английски език', 'История и цивилизации', 'Физическо възпитание'],
    ['Български език', 'Човекът и природата', 'Математика', 'География и икономика', 'Английски език'],
    ['Математика', 'Български език', 'Човекът и природата', 'Английски език', 'Компютърно моделиране', 'Физическо възпитание'],
    ['Български език', 'Математика', 'История и цивилизации', 'Английски език', 'География и икономика'],
    ['Човекът и природата', 'Математика', 'Български език', 'Компютърно моделиране', 'Физическо възпитание'],
];
export const times = ['08:00', '08:55', '09:50', '10:55', '11:50', '12:45'];
export const lessonEnds = ['08:40', '09:35', '10:30', '11:35', '12:30', '13:25'];
export function seedRecords(): SchoolRecord[] {
    const day=(n:number)=>plusDays(schoolToday(),n);
    let previousSchool=day(-1);while([0,6].includes(new Date(previousSchool+'T12:00:00Z').getUTCDay()))previousSchool=plusDays(previousSchool,-1);
    const criteria=[{id:'accuracy',title:'Верни изчисления',description:'Намери общ знаменател и съкрати крайния резултат.',maxPoints:5},{id:'method',title:'Обяснение на стъпките',description:'Покажи как преобразуваш и събираш дробите.',maxPoints:3},{id:'clarity',title:'Ясно представяне',description:'Подреди решението така, че друг човек да го проследи.',maxPoints:2}];
    return [
        ...featureSeedRecords(),
        ...enrichmentSeedRecords(),
        {id:`attendance-0-${previousSchool}-0`,kind:'attendance',studentId:0,date:previousSchool,lesson:0,status:'absent',version:0,createdAt:previousSchool+'T08:00:00Z'},
        {id:`attendance-0-${previousSchool}-1`,kind:'attendance',studentId:0,date:previousSchool,lesson:1,status:'late',version:0,createdAt:previousSchool+'T09:00:00Z',explanation:{body:'Закъснението беше заради промяна в семейната организация за пътуването. Моля за преглед.',status:'pending',submittedAt:previousSchool+'T12:00:00Z',submittedBy:'Елена Петрова'}},
        { id: 'assignment-fractions', kind: 'assignment', title: 'Обикновени дроби: събиране и изваждане', criteria, subject: 'Математика', due: day(1), description: 'Реши задачите и запиши стъпките: 1) 1/3 + 1/6; 2) 3/4 − 1/8; 3) 2/5 + 3/10. Обясни как намираш общ знаменател.', className: '6. А', teacher: 'Мария Николова', format: 'Задачи', estimated: 20 },
        {id:'submission-assignment-fractions-0',kind:'submission',assignmentId:'assignment-fractions',studentId:0,body:'1) 1/3 + 1/6 = 2/6 + 1/6 = 3/6 = 1/2\n2) 3/4 − 1/8 = 6/8 − 1/8 = 5/8\n3) 2/5 + 3/10 = 5/15',criteria,status:'revision',feedback:'Първите две решения са верни и добре подредени. В третата задача използвай общ знаменател 10. Обясни защо знаменателите не се събират.',flag:false,aiUse:false,files:[],attempt:1,version:0,createdAt:day(0)+'T07:00:00Z',submittedAt:day(0)+'T07:00:00Z',reviewedAt:day(0)+'T08:00:00Z'},
        {id:'submission-assignment-fractions-1',kind:'submission',assignmentId:'assignment-fractions',studentId:1,body:'1) 1/3 + 1/6 = 2/6 + 1/6 = 3/6 = 1/2\n2) 3/4 − 1/8 = 6/8 − 1/8 = 5/8\n3) 2/5 + 3/10 = 4/10 + 3/10 = 7/10\n\nПърво търся общ знаменател. Променям числителя и знаменателя с един и същ множител, за да запазя стойността на дробта.',criteria,status:'submitted',feedback:'',flag:false,aiUse:false,files:[],attempt:1,version:0,createdAt:day(0)+'T09:20:00Z',submittedAt:day(0)+'T09:20:00Z'},
        { id: 'assignment-story', kind: 'assignment', title: 'Един необикновен учебен ден', subject: 'Български език', due: day(2), description: 'Напиши кратък разказ от 150–200 думи. Използвай ясен увод, развитие на случката и край. Подчертай три прилагателни имена.', className: '6. А', teacher: 'Десислава Иванова', format: 'Творческа задача', estimated: 30 },
        { id: 'assignment-plants', kind: 'assignment', title: 'Как се хранят растенията?', subject: 'Човекът и природата', due: day(3), description: 'Опиши с твои думи ролята на светлината, водата и въглеродния диоксид при фотосинтезата. Добави схема или снимка на твоя рисунка.', className: '6. А', teacher: 'Петър Стоянов', format: 'Проект', estimated: 25 },
        { id: 'assignment-english', kind: 'assignment', title: 'My favourite place', subject: 'Английски език', due: day(-1), description: 'Write 6 sentences about your favourite place. Use there is / there are.', className: '6. А', teacher: 'Анна Колева', format: 'Писмена работа', estimated: 15 },
        { id: 'submission-assignment-english-0', kind: 'submission', assignmentId: 'assignment-english', studentId: 0, body: 'My favourite place is the school library. There are many books. There is a big table. There are comfortable chairs. There is a window near the table. I like reading there.', status: 'reviewed', feedback: 'Много добро използване на there is / there are. Продължавай така!', aiUse: false, createdAt: day(-1) + 'T14:30:00Z', files: [] },
        ...subjects.flatMap((subject, si) => [0, 1, 2].map((_, i) => ({ id: `grade-0-${si}-${i}`, kind: 'grade', studentId: 0, subject, value: [6, 5, 6, 5, 6, 5, 5, 6, 6, 6, 5, 6, 5, 5, 6, 6, 5, 5][si * 3 + i], type: i === 0 ? 'Класна работа' : 'Устно изпитване', comment: 'Примерна оценка', date: day(-2 - i * 3) }))),
        ...students.slice(1).map((_, i) => ({ id: `grade-${i + 1}-0`, kind: 'grade', studentId: i + 1, subject: 'Математика', value: [5, 6, 5, 4, 6, 5, 6][i], type: 'Класна работа', comment: 'Примерна оценка', date: day(-2) })),
        { id: 'doc-trip', kind: 'document', title: 'Съгласие за учебно посещение', category: 'Родителско съгласие', content: `Уважаеми родители,\n\nПланираме учебно посещение на природонаучен музей на ${new Date(day(7)+'T12:00:00Z').toLocaleDateString('bg-BG',{day:'numeric',month:'long'})}. Сборен пункт: училищният двор, 09:00 ч. Връщане: 13:00 ч. Учениците ще бъдат придружавани от двама учители.\n\nМоля, отбележете дали сте запознати с организацията. Този документ е образец в демонстрационна среда.`, status: 'pending', due: day(4), createdAt: day(0), version: 1 },
        { id: 'doc-rules', kind: 'document', title: 'Правила за работа с Eduo', category: 'Информация', content: 'Всеки ученик има право на подкрепа, обратна връзка и собствен темп на учене.\n\nИзползването на AI се декларира според указанията на учителя. Сигналите за авторство са повод за разговор, а не доказателство.\n\nДанните в тази среда са примерни.', status: 'acknowledged', ackName: 'Елена Петрова', ackAt: day(-3) + 'T10:00:00Z', createdAt: day(-4), version: 1 },
        { id: 'doc-club-draft', kind: 'document', title: 'Работилница по природни науки', category: 'Информация', content: 'Уважаеми родители,\n\nПодготвяме занимание по природни науки за 6. А клас. Учениците ще работят по малки практически задачи и ще представят своите наблюдения.\n\nДата и място: предстои уточняване.\nНеобходими материали: тетрадка и цветни моливи.\n\nТова е работна чернова. Ще предоставим окончателната организация за преглед след уточняване на детайлите.', status: 'draft', due: day(7), version: 1, revision: 0, files: [], createdAt: day(0), createdBy: 'Мария Николова', events: [{ type: 'document', by: 'Мария Николова', at: day(0)+'T07:00:00Z', version: 1 }] },
        { id: 'doc-meeting', kind: 'document', title: 'Родителска среща · актуализиран час', category: 'Информация', content: 'Уважаеми родители,\n\nРодителската среща на 6. А клас ще започне в 18:30 ч. в кабинет 202.\n\nЩе обсъдим организацията на учебната работа, предстоящите проекти и как училището и семейството могат да подкрепят учениците.\n\nПроменен е само началният час. Моля, запознайте се с актуализираната организация.\n\nС уважение,\nКласният ръководител', status: 'pending', due: day(5), version: 2, revision: 0, files: [], createdAt: day(-2), publishedAt: day(0)+'T09:00:00Z', versions: [{ title: 'Родителска среща', content: 'Уважаеми родители,\n\nРодителската среща ще започне в 18:00 ч. в кабинет 202. Ще обсъдим учебната работа и предстоящите проекти.', category: 'Информация', due: day(5), status: 'withdrawn', version: 1, files: [], publishedAt: day(-2)+'T08:00:00Z', withdrawnAt: day(-1)+'T12:00:00Z', withdrawalReason: 'Началният час се променя на 18:30 ч.' }], events: [{ type: 'publish-document', by: 'Мария Николова', at: day(-2)+'T08:00:00Z', version: 1 }, { type: 'withdraw-document', by: 'Мария Николова', at: day(-1)+'T12:00:00Z', version: 1, note: 'Началният час се променя на 18:30 ч.' }, { type: 'publish-document', by: 'Мария Николова', at: day(0)+'T09:00:00Z', version: 2 }] },
        { id: 'message-welcome', kind: 'message', thread: 'class', from: 'teacher', body: 'Добре дошли в новата учебна година! Тук ще споделяме задачи, материали и важна информация за 6. А клас.', createdAt: day(0) + 'T07:30:00Z' },
        { id: 'message-parent', kind: 'message', thread: 'parents', from: 'teacher', body: 'Съгласието за учебното посещение е в раздел „Документи“. Моля, прегледайте го до края на седмицата.', createdAt: day(0) + 'T08:00:00Z' },
        { id: 'profile', kind: 'profile', style: 'examples', pace: 'steady', interests: 'Технологии, природа', remember: true },
        { id: 'policy', kind: 'policy', mode: 'learning', domains: 'edu.mon.bg\nmon.bg', apps: 'Браузър\nКалкулатор', camera: false },
    ];
}
export type Lesson = {
    id: string;
    title: string;
    subject: string;
    duration: number;
    tag: string;
    intro: string;
    steps: string[];
    example: string;
    question: string;
    options: string[];
    answer: number;
    explanation: string;
    symbol: string;
    color: string;
};
export const lessons: Lesson[] = [
    { id: 'fractions', title: 'Дробите вече имат смисъл', subject: 'Математика', duration: 12, tag: 'С примери от ежедневието', intro: 'Дробта показва колко равни части от едно цяло разглеждаме. Знаменателят казва на колко части е разделено цялото, а числителят — колко от тях вземаме.', steps: ['За да съберем дроби, частите трябва да са с еднакъв размер. Затова намираме общ знаменател.', 'За 1/3 и 1/6 общият знаменател е 6. Разширяваме 1/3 до 2/6.', 'Събираме числителите: 2/6 + 1/6 = 3/6. Съкращаваме и получаваме 1/2.'], example: 'Представи си шоколад с 6 равни парчета. Една трета са 2 парчета. Още една шеста е 1 парче. Общо имаш 3 от 6 парчета — половин шоколад.', question: 'Колко е 1/4 + 1/2?', options: ['2/6', '3/4', '1/8', '2/4'], answer: 1, explanation: '1/2 = 2/4, затова 1/4 + 2/4 = 3/4. Знаменателят остава 4.', symbol: '½', color: 'violet' },
    { id: 'photosynthesis', title: 'Малката фабрика в листата', subject: 'Човекът и природата', duration: 9, tag: 'Стъпка по стъпка', intro: 'Растенията произвеждат хранителни вещества чрез фотосинтеза. За това са нужни светлина, вода и въглероден диоксид.', steps: ['Корените поемат вода от почвата. Тя достига до листата.', 'Листата приемат въглероден диоксид от въздуха. Хлорофилът поглъща светлинна енергия.', 'С тази енергия растението образува глюкоза и отделя кислород.'], example: 'Растението е като малка фабрика: водата и въглеродният диоксид са суровини, светлината е енергията, а глюкозата е продуктът.', question: 'Кое е източникът на енергия за фотосинтезата?', options: ['Почвата', 'Кислородът', 'Светлината', 'Вятърът'], answer: 2, explanation: 'Светлинната енергия се поглъща от хлорофила и се използва за образуване на хранителни вещества.', symbol: 'CO₂', color: 'green' },
    { id: 'adjectives', title: 'Думите, които рисуват', subject: 'Български език', duration: 8, tag: 'Кратко и ясно', intro: 'Прилагателното име означава признак на предмет. Съгласува се със съществителното по род и число.', steps: ['Намери съществителното: „ден“. То е от мъжки род, единствено число.', 'Задай въпроса „какъв?“: слънчев, дълъг, необикновен.', 'Когато съществителното се промени, прилагателното също се променя: слънчев ден → слънчеви дни.'], example: '„Книга“ става „интересна книга“. „Море“ става „спокойно море“. С прилагателните описанието става по-точно.', question: 'Коя дума е прилагателно име в „Тихият вятър духа“?', options: ['Тихият', 'Вятър', 'Духа', 'Няма прилагателно'], answer: 0, explanation: '„Тихият“ означава признак на вятъра и отговаря на въпроса „какъв?“.', symbol: 'Аа', color: 'orange' },
];
export const sources = [
    { name: 'Shkolo', url: 'https://www.shkolo.bg/features/', summary: 'Дневник, отсъствия, домашни, комуникация, учебни материали и календар. В Eduo тези ежедневни дейности са свързани с индивидуалното учене.' },
    { name: 'АдминПлюс', url: 'https://dogovori.adminplus.bg/Questions', summary: 'Административна широчина: дневник, ученически профил, справки, протоколи и училищна документация. Eduo започва с дневник и документооборот.' },
    { name: 'Дигитална раница · МОН', url: 'https://edu.mon.bg/', summary: 'Образователно съдържание и ресурси за ученици и учители. Eduo добавя персонален учебен маршрут; външното съдържание се отваря при доставчика.' },
];
