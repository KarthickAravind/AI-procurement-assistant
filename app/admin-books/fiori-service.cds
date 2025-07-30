using { AdminService } from '../../srv/admin-service.cds';
using { sap.procurement } from '../../db/schema';

////////////////////////////////////////////////////////////////////////////
//
//	Suppliers Object Page
//

annotate AdminService.Suppliers with @(UI: {
  HeaderInfo       : {
    TypeName      : '{i18n>Supplier}',
    TypeNamePlural: '{i18n>Suppliers}',
    Title         : {Value: name},
    Description   : {Value: region}
  },
  Facets: [
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>General}',
      Target: '@UI.FieldGroup#General'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>Contact}',
      Target: '@UI.FieldGroup#Contact'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>Admin}',
      Target: '@UI.FieldGroup#Admin'
    },
  ],
  FieldGroup #General: {Data: [
    {Value: name},
    {Value: region},
    {Value: category},
    {Value: material},
    {Value: pricePerUnit},
    {Value: leadTime},
    {Value: rating},
  ]},
  FieldGroup #Contact: {Data: [
    {Value: contactEmail},
    {Value: contactPhone},
    {Value: address},
  ]},
  FieldGroup #Admin: {Data: [
    {Value: createdBy},
    {Value: createdAt},
    {Value: modifiedBy},
    {Value: modifiedAt}
  ]}
});


////////////////////////////////////////////////////////////
//
//  Materials Object Page
//

annotate AdminService.Materials with @(UI: {
  HeaderInfo       : {
    TypeName      : '{i18n>Material}',
    TypeNamePlural: '{i18n>Materials}',
    Title         : {Value: name},
    Description   : {Value: category}
  },
  Facets: [
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>General}',
      Target: '@UI.FieldGroup#General'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>Stock}',
      Target: '@UI.FieldGroup#Stock'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>Admin}',
      Target: '@UI.FieldGroup#Admin'
    },
  ],
  FieldGroup #General: {Data: [
    {Value: name},
    {Value: category},
    {Value: description},
    {Value: unitPrice},
    {Value: unit},
  ]},
  FieldGroup #Stock: {Data: [
    {Value: quantity},
    {Value: minStockLevel},
    {Value: maxStockLevel},
    {Value: location},
  ]},
  FieldGroup #Admin: {Data: [
    {Value: createdBy},
    {Value: createdAt},
    {Value: modifiedBy},
    {Value: modifiedAt}
  ]}
});

// In addition we need to expose Languages through AdminService as a target for ValueList
using {sap} from '@sap/cds/common';

extend service AdminService {
  @readonly entity Languages as projection on sap.common.Languages;
}
