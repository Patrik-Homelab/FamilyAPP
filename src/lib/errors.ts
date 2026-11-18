export const ERRORS = {
    auth: {
        login: {
            username: 'Zadal jsi neplatné uživatelské jméno',
            password: 'Zadal jsi špatné heslo'
        },
        register: {
            username: 'Toto uživatelské jméno již je zabráno'
        }
    },
    invitation: {
        code: 'Kód pozvánky je neplatný, pravděpodobně ho již někdo využil'
    },
    debt: {
        input: 'Neplatný vstup',
        negative: 'Zadej prosím platnou hodnotu',
        file: 'Vyber platný soubor',
        size: 'Vybral jsi moc velký soubor',
        range: 'Zadal jsi moc velké číslo'
    },
    calendar: {
        date: 'Zadal jsi neplatné datum',
        delete: 'Nemáš právo smazat tuto událost'
    },
    presents: {
        input: 'Neplatný vstup',
        negative: 'Zadej prosím platnou hodnotu',
        file: 'Vyber platný soubor',
        size: 'Vybral jsi moc velký soubor',
        range: 'Zadal jsi moc velké číslo',
        notFound: 'Dárek nenalezen',
        own: 'Nemůžeš si změnit stav svého dárku',
        other: 'Někdo jiný si již dárek vybral'
    },
    shoppinglist: {
        input: 'Neplatný vstup',
        negative: 'Zadej prosím platnou hodnotu',
        file: 'Vyber platný soubor',
        size: 'Vybral jsi moc velký soubor',
        notFound: 'Tato položka nebyla nalezena',
        author: 'Nemáš právo smazat tuto položku',
        bought: 'Někdo již nějakou vybranou položku koupil'
    },
    server: {
        error: 'Něco se nepovedlo na serveru'
    },
    users: {
        notFound: 'Uživatel nenalezen'
    },
    family: {
        notFound: 'Rodina nebyla nalezena',
        invalidJoinCode: 'Neplatný kód pozvánky nebo rodiny',
        haDisabled: 'Sledování teploty vody není pro tuto rodinu povoleno',
        haConnectionFailed: 'Nepodařilo se připojit k Home Assistant',
        invalidSensors: 'Zadejte alespoň jeden platný senzor'
    },
    groups: {
        notFound: 'Skupina nebyla nalezena'
    }
} as const;

// Recursive helper to traverse the object and build paths
type ExtractPaths<
    $CurrentObject,
    $Path extends string = ''
> = $CurrentObject extends string
    ? $Path // If T is a string, return the accumulated path
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $CurrentObject extends Record<string, any>
      ? {
            [K in keyof $CurrentObject]: ExtractPaths<
                $CurrentObject[K],
                `${$Path}${$Path extends '' ? '' : '.'}${K & string}`
            >;
        }[keyof $CurrentObject] // Recurse into object keys
      : never;

// Final type
export type ErrorList = ExtractPaths<typeof ERRORS>;

export const extractError = (error: string): string => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let base = ERRORS as any;
    error.split('.').forEach((key) => {
        if (key in base) {
            base = base[key];
        }
    });

    if (typeof base !== 'string') return error;

    return base;
};

export const matchError = (
    error: string,
    errorToMatch: ErrorList
): error is typeof errorToMatch => {
    return error === errorToMatch;
};
