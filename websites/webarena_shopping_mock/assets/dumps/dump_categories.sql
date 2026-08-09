SELECT JSON_OBJECT('entity_id',c.entity_id,'parent_id',c.parent_id,'path',c.path,'position',c.position,'level',c.level,
 'children_count',c.children_count,
 'name',(SELECT value FROM catalog_category_entity_varchar WHERE entity_id=c.entity_id AND attribute_id=45 AND store_id=0 LIMIT 1),
 'url_key',(SELECT value FROM catalog_category_entity_varchar WHERE entity_id=c.entity_id AND attribute_id=119 AND store_id=0 LIMIT 1),
 'url_path',(SELECT value FROM catalog_category_entity_varchar WHERE entity_id=c.entity_id AND attribute_id=120 AND store_id=0 LIMIT 1),
 'is_active',(SELECT value FROM catalog_category_entity_int WHERE entity_id=c.entity_id AND attribute_id=46 AND store_id=0 LIMIT 1),
 'include_in_menu',(SELECT value FROM catalog_category_entity_int WHERE entity_id=c.entity_id AND attribute_id=69 AND store_id=0 LIMIT 1),
 'product_count',(SELECT COUNT(*) FROM catalog_category_product WHERE category_id=c.entity_id)
) FROM catalog_category_entity c ORDER BY c.path;
