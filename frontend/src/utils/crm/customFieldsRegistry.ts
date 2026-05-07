
export interface CustomFieldTemplate {
  key: string;
  type: string;
  sectionId?: string;
}

/**
 * Gets the persisted custom field templates for a specific entity type.
 */
export const getCustomFieldTemplates = (entityType: 'lead' | 'deal'): CustomFieldTemplate[] => {
  try {
    const data = localStorage.getItem(`crm_custom_fields_template_${entityType}`);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load custom field templates', e);
    return [];
  }
};

/**
 * Persists a list of custom field definitions as templates for future records.
 */
export const saveCustomFieldTemplates = (entityType: 'lead' | 'deal', fields: { key: string; type?: string }[]) => {
  try {
    // We only care about the keys and types for the template
    const templates: CustomFieldTemplate[] = fields
      .filter(f => f.key && f.key.trim() !== '')
      .map(f => ({
        key: f.key.trim(),
        type: (f as any).type || 'string',
        sectionId: (f as any).sectionId
      }));

    // Deduplicate to ensure unique field keys
    const uniqueTemplates = Array.from(
      new Map(templates.map(item => [item.key, item])).values()
    );

    localStorage.setItem(`crm_custom_fields_template_${entityType}`, JSON.stringify(uniqueTemplates));
  } catch (e) {
    console.error('Failed to save custom field templates', e);
  }
};

/**
 * Merges existing field values with templates to ensure all standard custom fields are present.
 */
export const mergeFieldsWithTemplates = (
  entityType: 'lead' | 'deal', 
  existingFields: { id: string; key: string; value: string; type?: string; sectionId?: string }[]
) => {
  const templates = getCustomFieldTemplates(entityType);
  const merged = [...existingFields];

  templates.forEach(template => {
    const existingIndex = merged.findIndex(f => f.key === template.key);
    if (existingIndex !== -1) {
      // Update existing field's sectionId to match template
      if (template.sectionId) {
        merged[existingIndex] = { ...merged[existingIndex], sectionId: template.sectionId };
      }
    } else {
      merged.push({
        id: `template-${Math.random().toString(36).substr(2, 9)}`,
        key: template.key,
        value: "",
        type: template.type,
        sectionId: template.sectionId || "custom-fields"
      });
    }
  });

  return merged;
};
