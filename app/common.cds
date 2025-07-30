/*
 Common Annotations shared by all apps
*/

using { sap.procurement as my } from '../db/schema';
using { sap.common, sap.common.Currencies } from '@sap/cds/common';

////////////////////////////////////////////////////////////////////////////
//
//	Suppliers Lists
//
annotate my.Suppliers with @(
  Common.SemanticKey: [ID],
  UI: {
    Identification: [{ Value: name }],
    SelectionFields: [
      ID,
      name,
      region,
      category,
      rating
    ],
    LineItem: [
      { Value: ID, Label: '{i18n>ID}' },
      { Value: name, Label: '{i18n>Name}' },
      { Value: region, Label: '{i18n>Region}' },
      { Value: category, Label: '{i18n>Category}' },
      { Value: material, Label: '{i18n>Material}' },
      { Value: pricePerUnit, Label: '{i18n>Price}' },
      { Value: rating, Label: '{i18n>Rating}' },
    ]
  }
) {
  ID @Common: {
    SemanticObject: 'Suppliers',
    Text: name,
    TextArrangement: #TextOnly
  };
};

annotate Currencies with {
  symbol @Common.Label: '{i18n>Currency}';
}


////////////////////////////////////////////////////////////////////////////
//
//	Suppliers Elements
//
annotate my.Suppliers with {
  ID           @title: '{i18n>ID}';
  name         @title: '{i18n>Name}';
  region       @title: '{i18n>Region}';
  material     @title: '{i18n>Material}';
  pricePerUnit @title: '{i18n>Price}' @Measures.ISOCurrency: currency_code;
  leadTime     @title: '{i18n>LeadTime}';
  rating       @title: '{i18n>Rating}';
  category     @title: '{i18n>Category}';
  contactEmail @title: '{i18n>Email}';
  contactPhone @title: '{i18n>Phone}';
  address      @title: '{i18n>Address}' @UI.MultiLineText;
}

////////////////////////////////////////////////////////////////////////////
//
//	Materials List
//
annotate my.Materials with @(
  Common.SemanticKey: [ID],
  UI: {
    SelectionFields: [ID, name, category],
    LineItem: [
      { Value: ID, Label: '{i18n>ID}' },
      { Value: name, Label: '{i18n>Name}' },
      { Value: category, Label: '{i18n>Category}' },
      { Value: quantity, Label: '{i18n>Quantity}' },
      { Value: unitPrice, Label: '{i18n>UnitPrice}' },
      { Value: location, Label: '{i18n>Location}' },
    ],
  }
);

annotate my.Materials with {
  ID  @Common.Text : name  @Common.TextArrangement : #TextOnly;
}

////////////////////////////////////////////////////////////////////////////
//
//	Material Details
//
annotate my.Materials with @(UI : {
  Identification: [{ Value: name}],
  HeaderInfo: {
    TypeName      : '{i18n>Material}',
    TypeNamePlural: '{i18n>Materials}',
    Title         : { Value: name },
    Description   : { Value: ID }
  },
  Facets: [{
    $Type : 'UI.ReferenceFacet',
    Label : '{i18n>Details}',
    Target: '@UI.FieldGroup#Details'
  }],
  FieldGroup #Details: {Data : [
    { Value: ID },
    { Value: name },
    { Value: category },
    { Value: quantity },
    { Value: unitPrice },
    { Value: location }
  ]},
});

////////////////////////////////////////////////////////////////////////////
//
//	Materials Elements
//
annotate my.Materials with {
  ID          @title: '{i18n>ID}';
  name        @title: '{i18n>Name}';
  category    @title: '{i18n>Category}';
  quantity    @title: '{i18n>Quantity}';
  unitPrice   @title: '{i18n>UnitPrice}' @Measures.ISOCurrency: currency_code;
  minStockLevel @title: '{i18n>MinStock}';
  maxStockLevel @title: '{i18n>MaxStock}';
  unit        @title: '{i18n>Unit}';
  description @title: '{i18n>Description}' @UI.MultiLineText;
  location    @title: '{i18n>Location}';
}

////////////////////////////////////////////////////////////////////////////
//
//	Languages List
//
annotate common.Languages with @(
  Common.SemanticKey: [code],
  Identification: [{ Value: code }],
  UI: {
    SelectionFields: [ name, descr ],
    LineItem: [
      { Value: code },
      { Value: name },
    ],
  }
);

////////////////////////////////////////////////////////////////////////////
//
//	Language Details
//
annotate common.Languages with @(UI : {
  HeaderInfo: {
    TypeName      : '{i18n>Language}',
    TypeNamePlural: '{i18n>Languages}',
    Title         : { Value: name },
    Description   : { Value: descr }
  },
  Facets: [{
    $Type : 'UI.ReferenceFacet',
    Label : '{i18n>Details}',
    Target: '@UI.FieldGroup#Details'
  }, ],
  FieldGroup #Details: {Data : [
    { Value: code },
    { Value: name },
    { Value: descr }
  ]},
});

////////////////////////////////////////////////////////////////////////////
//
//	Currencies List
//
annotate common.Currencies with @(
  Common.SemanticKey: [code],
  Identification: [{ Value: code}],
  UI: {
    SelectionFields: [
      name,
      descr
    ],
    LineItem: [
      { Value: descr },
      { Value: symbol },
      { Value: code },
    ],
  }
);

////////////////////////////////////////////////////////////////////////////
//
//	Currency Details
//
annotate common.Currencies with @(UI : {
  HeaderInfo: {
    TypeName      : '{i18n>Currency}',
    TypeNamePlural: '{i18n>Currencies}',
    Title         : { Value: descr },
    Description   : { Value: code }
  },
  Facets: [
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>Details}',
      Target: '@UI.FieldGroup#Details'
    }
  ],
  FieldGroup #Details: {Data : [
    { Value: name },
    { Value: symbol },
    { Value: code },
    { Value: descr }
  ]}
});
