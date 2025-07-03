// JSONの構造に合わせた型定義
export interface FormInfo {
  id: string | null;
  title: string | null;
  submitUrl: string | null;
  logo: {
    src: string | null;
    width: number | null;
    height: number | null;
    alt: string | null;
  } | null;
}

export interface FormField {
  qid: string | null;
  id: string | null;
  name: string | null;
  type: string | null;
  text: string | null;
  subLabel?: string | null;
  options?: any[] | null;
  subfields?: any[] | null;
  defaultValue?: any;
  validation?: string | null;
  hidden: boolean;
  order: number;
}

export interface FieldGroup {
  collapseField: FormField;
  childFields: FormField[];
}

export interface Condition {
  id: string;
  type: string;
  priority: string;
  link: string;
  terms: {
    field: string;
    operator: string;
    value: string;
  }[];
  action: {
    id: string;
    visibility: string;
    fields?: string[];
    field?: string;
  };
}

export interface JotformStructure {
  formInfo: FormInfo;
  fieldGroups: FieldGroup[];
  conditions: Condition[];
}

/**
 * ページ内のscriptタグからJotFormの条件設定を正規表現で抽出して解析します。
 * @returns {Condition[]} 解析された条件オブジェクトの配列
 */
function extractConditionsFromScripts(): Condition[] {
  const scripts = Array.from(document.querySelectorAll('script'));
  const conditionsRegex = /JotForm\.setConditions\((.*?)\);/;

  for (const script of scripts) {
    if (script.textContent) {
      const match = script.textContent.match(conditionsRegex);
      if (match && match[1]) {
        try {
          return JSON.parse(match[1]);
        } catch (e) {
          console.error("Failed to parse JotForm conditions:", e);
          return [];
        }
      }
    }
  }
  return [];
}


/**
 * DOM要素からJotFormの全フィールドを解析し、構造化された配列を返します。
 * @returns {FormField[]} フィールドオブジェクトの配列
 */
function extractFieldsFromDOM(): FormField[] {
    const fieldElements = Array.from(document.querySelectorAll<HTMLElement>('.form-section > li, .form-section-closed > li'));
    let order = 1;

    // "control_button" が ul の外にあるため、別途取得してリストに追加
    const buttonElement = document.querySelector<HTMLElement>('#id_2');

    const allElements = [...fieldElements];
    if (buttonElement && !fieldElements.includes(buttonElement)) {
        allElements.push(buttonElement);
    }


    const fields: FormField[] = allElements.map(el => {
        const field: Partial<FormField> = {};

        field.id = el.id;
        field.type = el.dataset.type || null;
        // 親要素が非表示の場合も考慮
        field.hidden = getComputedStyle(el).display === 'none' || el.classList.contains('form-field-hidden') || (el.parentElement?.style.display === 'none');
        field.order = order++;

        const nameAttrSource = el.querySelector('[name]');
        if (nameAttrSource) {
            const name = nameAttrSource.getAttribute('name')!;
            const qidMatch = name.match(/^q(\d+)_/);
            field.qid = qidMatch ? qidMatch[1] : null;
            field.name = name.split('[')[0];
        }

        const labelEl = el.querySelector('.form-label, .form-header, .form-collapse-mid');
        field.text = labelEl ? labelEl.textContent?.trim() || null : null;
        
        const subLabelEl = el.querySelector('.form-sub-label');
        field.subLabel = subLabelEl ? subLabelEl.textContent?.trim() : null;

        switch (field.type) {
            case 'control_dropdown':
                const selectEl = el.querySelector('select');
                field.name = selectEl?.name || null;
                field.qid = selectEl?.name.match(/^q(\d+)_/)?.[1] || null;
                field.options = selectEl ? Array.from(selectEl.options).map(opt => opt.text) : [];
                break;
            case 'control_radio':
                field.options = Array.from(el.querySelectorAll('.form-radio-item')).map(item => item.querySelector('label')?.textContent?.trim());
                break;
            case 'control_fullname':
                field.subfields = Array.from(el.querySelectorAll<HTMLElement>('.form-sub-label-container')).map(sub => ({
                    name: sub.dataset.inputType,
                    label: sub.querySelector('label')?.textContent?.trim()
                }));
                break;
            case 'control_email':
                 const emailInput = el.querySelector('input[type="email"]');
                 if(emailInput?.classList.contains('validate[Email]')) {
                    field.validation = 'Email';
                 }
                 break;
            case 'control_button':
                const buttonEl = el.querySelector('button');
                field.qid = el.id.replace('id_', '');
                field.text = buttonEl ? buttonEl.textContent?.trim() : null;
                field.name = 'submit';
                break;
        }
        
        if (!field.qid) {
             const idMatch = el.id.match(/\d+/);
             if (idMatch) field.qid = idMatch[0];
        }

        return field as FormField;
    });

    return fields;
}

/**
 * フィールドのリストを "control_collapse" を基点にグループ化します。
 * @param fields - 全てのフィールドが含まれるフラットな配列
 * @returns グループ化されたフィールドの配列
 */
function groupFields(fields: FormField[]): FieldGroup[] {
    const fieldGroups: FieldGroup[] = [];
    let currentGroup: FieldGroup | null = null;

    fields.forEach(field => {
        if (field.type === 'control_collapse') {
            // 既存のグループがあれば、それを配列に追加
            if (currentGroup) {
                fieldGroups.push(currentGroup);
            }
            // 新しいグループを開始
            currentGroup = {
                collapseField: field,
                childFields: []
            };
        } else if (currentGroup) {
            // 現在のグループにフィールドを追加
            currentGroup.childFields.push(field);
        }
    });

    // ループ終了後、最後のグループを配列に追加
    if (currentGroup) {
        fieldGroups.push(currentGroup);
    }

    return fieldGroups;
}

/**
 * JotFormの構造全体を解析し、単一のJSONオブジェクトとして返します。
 * (この関数を外部から呼び出せるように export しています)
 * @returns {JotformStructure} フォームの構造全体
 */
export function getJotformStructure(): JotformStructure {
  const formEl = document.querySelector<HTMLFormElement>('form.jotform-form');
  const titleEl = document.querySelector<HTMLHeadingElement>('h1.form-header');
  const logoEl = document.querySelector<HTMLImageElement>('img.form-page-cover-image');

  const formInfo: FormInfo = {
    id: formEl?.id || null,
    title: titleEl?.textContent?.trim() || null,
    submitUrl: formEl?.action || null,
    logo: logoEl ? {
      src: logoEl.src,
      width: parseInt(logoEl.getAttribute('width') || '0', 10),
      height: parseInt(logoEl.getAttribute('height') || '0', 10),
      alt: logoEl.alt,
    } : null,
  };

  const allFields = extractFieldsFromDOM();
  const groupedFields = groupFields(allFields);
  const conditions = extractConditionsFromScripts();

  return {
    formInfo,
    fieldGroups: groupedFields,
    conditions,
  };
}
